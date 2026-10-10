import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import multipart from '@fastify/multipart';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {db,noteInclude,presentNote} from './db.js';
import {root,port,baseUrl,token,attachmentsRoot} from './config.js';
import {enqueue,collect,record,workQueue,sourceId,closeReader,resolveTurn} from './archive.js';
import {exportBackup,restoreBackup} from './backup.js';
import {getDashboard,recordReview} from './dashboard.js';
import {highlightsSchema} from './highlights.js';
import {unlinkedImagesError} from './completeness.js';
import {acquire,exclusive} from './lock.js';
import {appVersion} from '../shared/runtime.mjs';
export const app=Fastify({logger:true,bodyLimit:4*1024*1024});
app.addHook('onRequest',async(req,reply)=>{
 const host=req.headers.host; if(host!==`127.0.0.1:${port}`&&host!==`localhost:${port}`){reply.code(403).send({error:'无效本机地址'});return}
 const origin=req.headers.origin;if(origin&&origin!==baseUrl&&origin!==`http://localhost:${port}`){reply.code(403).send({error:'仅允许同源访问'});return}
 if(req.url.startsWith('/api/v1/archive')&&req.headers.authorization!==`Bearer ${token}`){reply.code(401).send({error:'归档凭证无效'});return}
 if(!['GET','HEAD'].includes(req.method)&&!req.url.startsWith('/api/v1/archive')&&req.headers['x-shizhi-client']!=='web'){reply.code(403).send({error:'缺少本机网页请求标识'});return}
});
const releases=new WeakMap<object,()=>void>();
app.addHook('preHandler',async req=>{if(!['GET','HEAD'].includes(req.method))releases.set(req,await acquire())});
app.addHook('onResponse',async req=>{releases.get(req)?.();releases.delete(req)});
app.setErrorHandler((error,req,reply)=>{const e=error as Error & {statusCode?:number};reply.code(e instanceof z.ZodError?400: e.statusCode||400).send({error:e.message})});
app.register(multipart,{limits:{fileSize:100*1024*1024,files:1}});
app.get('/api/v1/health',async()=>({ok:true,version:appVersion}));
app.get('/api/v1/dashboard',async req=>getDashboard(z.object({period:z.enum(['90d','year']).default('90d')}).parse(req.query).period));
app.post('/api/v1/notes/:id/reviews',async req=>recordReview((req.params as any).id,req.body));
app.get('/api/v1/notes',async(req)=>{const q=z.object({q:z.string().optional(),subject:z.string().optional(),tag:z.string().optional(),kind:z.string().optional(),wrong:z.string().optional(),mastery:z.string().optional()}).parse(req.query);const notes=(await db.note.findMany({include:noteInclude,orderBy:{updatedAt:'desc'}})).map(presentNote);return notes.filter(n=>(!q.q||[n.title,n.question,n.explanation,n.reflection,n.subject,...n.tags,...n.sources.map((s:any)=>s.question+' '+s.explanation),...n.knowledgePoints.map((p:any)=>p.label+' '+p.summary)].join(' ').toLowerCase().includes(q.q.toLowerCase()))&&(!q.subject||n.subject===q.subject)&&(!q.tag||n.tags.includes(q.tag))&&(!q.kind||n.kind===q.kind)&&(!q.wrong||n.wrong===(q.wrong==='true'))&&(!q.mastery||n.mastery===q.mastery))});
app.get('/api/v1/notes/:id',async(req,reply)=>{const n=await db.note.findUnique({where:{id:(req.params as any).id},include:noteInclude});if(!n)return reply.code(404).send({error:'笔记不存在'});return presentNote(n)});
const manualSchema=z.object({title:z.string().min(1).max(200).optional(),subject:z.string().min(1).max(80).optional(),tags:z.array(z.string().min(1).max(80)).max(30).optional(),reflection:z.string().max(50000).optional(),wrong:z.boolean().optional(),wrongReason:z.string().max(5000).optional(),mastery:z.enum(['unmarked','review','mastered']).optional(),highlights:highlightsSchema.optional()}).strict();
app.patch('/api/v1/notes/:id',async(req)=>{const {title,subject,tags,highlights,...data}=manualSchema.parse(req.body);const n=await db.note.update({where:{id:(req.params as any).id},data:{...data,...(highlights!==undefined?{highlights:JSON.stringify(highlights)}:{}),...(title!==undefined?{manualTitle:title}:{}),...(subject!==undefined?{manualSubject:subject}:{}),...(tags!==undefined?{manualTags:JSON.stringify(tags)}:{})},include:noteInclude});return presentNote(n)});
app.get('/api/v1/attachments/:id',async(req,reply)=>{const a=await db.attachment.findUnique({where:{id:(req.params as any).id}});if(!a)return reply.code(404).send({error:'图片不存在'});return reply.header('Content-Type',a.mime).header('X-Content-Type-Options','nosniff').send(await readFile(join(attachmentsRoot,a.filename)))});
app.get('/api/v1/status',async()=>({sources:(await db.source.findMany({include:{attachments:true,links:true},orderBy:{updatedAt:'desc'}})).map(({raw,...s})=>s),events:await db.archiveEvent.findMany({select:{id:true,status:true,attempts:true,error:true,createdAt:true},orderBy:{createdAt:'desc'}})}));
app.post('/api/v1/sources/:id/retry',async(req)=>{const s=await db.source.findUniqueOrThrow({where:{id:(req.params as any).id}});return collect(s.threadId,s.turnId)});
app.post('/api/v1/events/:id/retry',async(req)=>{await db.archiveEvent.update({where:{id:(req.params as any).id},data:{status:'pending',attempts:0}});await workQueue();return {ok:true}});
app.get('/api/v1/backup',async(_,reply)=>reply.header('Content-Type','application/zip').header('Content-Disposition','attachment; filename="shizhi-backup.zip"').send(await exportBackup()));
let maintenance=false;
app.post('/api/v1/restore',async(req)=>{if(maintenance)throw new Error('正在恢复，请稍后');maintenance=true;try{const file=await req.file();if(!file)throw new Error('请选择备份包');const bytes=await file.toBuffer();if(file.file.truncated)throw new Error('备份超过 100 MB');return await restoreBackup(bytes)}finally{maintenance=false}});
app.post('/api/v1/archive/event',async(req)=>{if(maintenance)throw new Error('正在恢复，事件保留在队列');const event=await enqueue(req.body);await workQueue();return {eventId:event.id}});
app.post('/api/v1/archive/check',async(req)=>{if(maintenance)throw new Error('正在恢复');const {threadId,turnId,active}=z.object({threadId:z.string(),turnId:z.string(),active:z.boolean().default(false)}).parse(req.body);const s=await collect(threadId,turnId);if((s.disposition==='pending'||s.error===unlinkedImagesError||/^(最终回答缺少|多题讲解|讲解图片|讲解可视化文件|讲解引用的原图|聊天交互图解|图解依赖外部文件)/.test(s.error||''))&&!active&&!s.repairRequested){await db.source.update({where:{id:s.id},data:{repairRequested:true}});return {needsRepair:true,sourceId:s.id}}return {needsRepair:false,status:s.status}});
app.post('/api/v1/archive/context',async(req)=>{const input=z.object({threadId:z.string().min(1),turnId:z.string().optional()}).parse(req.body);const threadId=input.threadId;const turnId=await resolveTurn(threadId,input.turnId);await collect(threadId,turnId);const {raw,...source}=await db.source.findUniqueOrThrow({where:{id:sourceId(threadId,turnId)},include:{attachments:true}});return {source,notes:(await db.note.findMany({where:{sources:{some:{source:{threadId}}}},include:noteInclude})).map(presentNote)}});
app.post('/api/v1/archive/record',async(req)=>{if(maintenance)throw new Error('正在恢复');return record(req.body)});
if(existsSync(join(root,'dist')))app.register(staticPlugin,{root:join(root,'dist')});
app.setNotFoundHandler((req,reply)=>{if(req.url.startsWith('/api/'))return reply.code(404).send({error:'接口不存在'});return reply.sendFile('index.html')});
const interval=setInterval(()=>{if(!maintenance)exclusive(workQueue).catch(console.error)},10000);interval.unref();
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,async()=>{clearInterval(interval);closeReader();await app.close();await db.$disconnect();process.exit(0)});
await app.listen({host:'127.0.0.1',port});await exclusive(workQueue);
