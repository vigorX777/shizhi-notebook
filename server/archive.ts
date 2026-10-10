import {sameDirectory,insideDirectory} from '../shared/runtime.mjs';
import {readdir,readFile,unlink,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,noteInclude,presentNote} from './db.js';
import {learningRoot,queueRoot,dataRoot} from './config.js';
import {CodexReader} from './codex.js';
import {saveOriginal} from './attachments.js';
import {imagesLinked,unlinkedImagesError} from './completeness.js';
import {answerSection,knowledgePointsSchema} from './learning-content.js';
import {visualizationSchema,preserveVisualizations,embedVisualizations,visualReferenceError} from './visualizations.js';
export const eventSchema=z.object({session_id:z.string().min(1),turn_id:z.string().optional(),cwd:z.string(),hook_event_name:z.enum(['UserPromptSubmit','Stop','Interrupt','SessionEnd']),prompt:z.string().optional(),stop_hook_active:z.boolean().optional(),last_assistant_message:z.string().nullable().optional(),snapshot:z.object({id:z.string(),cwd:z.string(),capturedAt:z.number().int().positive().optional(),turns:z.array(z.any())}).optional()});
export const recordSchema=z.object({threadId:z.string(),turnId:z.string(),disposition:z.enum(['learning','non_learning']),items:z.array(z.object({itemKey:z.string().min(1).max(100),noteId:z.string().optional(),title:z.string().min(1).max(200),kind:z.enum(['question','knowledge']),subject:z.string().max(80).default('待分类'),tags:z.array(z.string().max(80)).max(30).default([]),question:z.string().min(1),explanation:z.string().min(1),questionNumber:z.string().optional(),attachmentIds:z.array(z.string()).default([]),captureMode:z.enum(['snapshot','final']).default('final'),answerHeading:z.string().trim().max(200).default(''),knowledgePoints:knowledgePointsSchema.default([]),visualizations:visualizationSchema.default([])})).max(50)}).superRefine((v,c)=>{if((v.disposition==='learning')!==!!v.items.length)c.addIssue({code:'custom',message:'学习内容必须有笔记；非学习内容不得创建笔记'})});
export const sourceId=(thread:string,turn:string)=>createHash('sha256').update(thread+':'+turn).digest('hex');
function snapshotRank(snapshot:any){
 const items=snapshot.turns.flatMap((turn:any)=>turn.items);
 const inputs=items.filter((item:any)=>item.type==='userMessage').flatMap((item:any)=>item.content);
 const held=inputs.filter((input:any)=>input.type==='localImage'&&typeof input.path==='string'&&insideDirectory(input.path,resolve(dataRoot,'ingress-originals'))).length;
 const answer=items.filter((item:any)=>item.type==='agentMessage').reduce((length:number,item:any)=>length+item.text.length,0);
 return [inputs.length,held,answer];
}
export async function enqueue(input:unknown){
 const e=eventSchema.parse(input);
 if(!sameDirectory(e.cwd,learningRoot))throw new Error('事件不属于专用学习项目');
 const id=createHash('sha256').update(`${e.session_id}:${e.turn_id||''}:${e.hook_event_name}`).digest('hex');
 if(e.turn_id&&e.prompt)await db.source.upsert({where:{id:sourceId(e.session_id,e.turn_id)},create:{id:sourceId(e.session_id,e.turn_id),threadId:e.session_id,turnId:e.turn_id,question:e.prompt,raw:JSON.stringify([{type:'text',text:e.prompt}]),status:'pending',error:'等待正式接口收集原始内容'},update:{}});
 const existing=await db.archiveEvent.findUnique({where:{id}});
 if(!existing)return db.archiveEvent.create({data:{id,payload:JSON.stringify(e)}});
 const previous=eventSchema.parse(JSON.parse(existing.payload));
 const merged={...previous,...Object.fromEntries(Object.entries(e).filter(([,value])=>value!==undefined))};
 // A duplicate can enrich the original event after its first disk copy was consumed.
 // An older replay must not discard a snapshot or a Stop continuation marker.
 if(previous.snapshot&&!e.snapshot)merged.snapshot=previous.snapshot;
 if(previous.snapshot&&e.snapshot){
  const oldRank=snapshotRank(previous.snapshot),newRank=snapshotRank(e.snapshot);
  const different=oldRank.findIndex((value,index)=>value!==newRank[index]);
  const older=previous.snapshot.capturedAt&&e.snapshot.capturedAt
   ?e.snapshot.capturedAt<previous.snapshot.capturedAt
   :different>=0&&newRank[different]<oldRank[different];
  if(older)merged.snapshot=previous.snapshot;
 }
 merged.stop_hook_active=previous.stop_hook_active||e.stop_hook_active;
 if(!e.last_assistant_message)merged.last_assistant_message=previous.last_assistant_message;
 const payload=JSON.stringify(merged);
 if(payload===existing.payload)return existing;
 return db.archiveEvent.update({where:{id},data:{payload,status:'pending',attempts:0,error:null}});
}
let reader:CodexReader|undefined;
export async function resolveTurn(threadId:string,turnId?:string){
 if(turnId?.trim())return turnId;
 reader??=new CodexReader();
 const thread=await reader.read(threadId);
 if(thread.id!==threadId||!sameDirectory(thread.cwd,learningRoot))throw new Error('会话不属于专用学习项目');
 const turn=thread.turns.at(-1);
 if(!turn)throw new Error('当前学习会话尚未返回轮次，请稍后重试');
 return turn.id as string;
}
export async function collect(threadId:string,turnId:string,officialAnswer?:string|null,snapshot?:any){
 reader??=new CodexReader();
 // UserPromptSubmit may fire before the user item is persisted. An empty captured
 // turn is not a durable substitute for a later official read.
 const captured=snapshot?.turns.find((turn:any)=>turn.id===turnId);
 const hasCapturedInput=captured?.items.some((item:any)=>item.type==='userMessage'&&item.content.length);
 let thread:any;try{thread=hasCapturedInput?snapshot:await reader.read(threadId)}catch(e){reader.close();reader=undefined;throw e}
 if(thread.id!==threadId||!sameDirectory(thread.cwd,learningRoot))throw new Error('会话不属于专用学习项目');
 const turn=thread.turns.find((t:any)=>t.id===turnId);if(!turn)throw new Error('该轮次尚未通过正式接口可读，等待重试');
 const inputs=turn.items.filter((i:any)=>i.type==='userMessage').flatMap((i:any)=>i.content);
 if(!inputs.length)throw new Error('正式接口尚未返回用户输入');
 const id=sourceId(threadId,turnId);
 const prior=await db.source.findUnique({where:{id:sourceId(threadId,turnId)}});
 const answer=turn.items.filter((i:any)=>i.type==='agentMessage'&&(i.phase==='final_answer'||i.phase===null)).map((i:any)=>i.text).join('\n\n')||officialAnswer||prior?.answer||'';
 const question=inputs.filter((i:any)=>i.type==='text').map((i:any)=>i.text).join('\n');
 await db.source.upsert({where:{id},create:{id,threadId,turnId,raw:JSON.stringify(inputs),question,answer},update:{raw:JSON.stringify(inputs),question,answer}});
 const errors:string[]=[];
 for(const [index,input] of inputs.entries()){if(!['image','localImage'].includes(input.type))continue;
 if(await db.attachment.findUnique({where:{sourceId_inputIndex:{sourceId:id,inputIndex:index}}}))continue;
 try{const saved=await saveOriginal(input);await db.attachment.create({data:{id:randomUUID(),sourceId:id,inputIndex:index,...saved}})}catch(e){errors.push(`第 ${index+1} 项图片：${(e as Error).message}`)}
 }
 const s=await db.source.findUniqueOrThrow({where:{id},include:{attachments:true,links:true}});
 // Completion requires every input image and structured explanation. Interrupted questions stay visible.
 const imageCount=inputs.filter((i:any)=>['image','localImage'].includes(i.type)).length;
 const linked=s.disposition==='non_learning'||imagesLinked(s.attachments,s.links);
 let answerError:string|null=null;
 if(answer&&s.disposition==='learning'){
  for(const link of s.links.filter(l=>l.captureMode==='final')){
   const section=answerSection(answer,link.answerHeading);
   const explanation=section===null?null:embedVisualizations(section,JSON.parse(link.visuals));
   if(!explanation){answerError='最终回答缺少题目小节：'+link.answerHeading;continue}
   const attachments=/attachment:|\/api\/v1\/attachments\//.test(explanation)?await db.attachment.findMany({where:{source:{links:{some:{noteId:link.noteId}}}},select:{id:true}}):[];
   answerError=visualReferenceError(explanation,new Set(attachments.map(a=>a.id)))||answerError;
   if(s.links.length>1&&!link.answerHeading){answerError='多题讲解尚未指定对应的二级标题';continue}
   if(explanation!==link.explanation){
    await db.$transaction(async tx=>{
     await tx.noteSource.update({where:{sourceId_itemKey:{sourceId:id,itemKey:link.itemKey}},data:{explanation}});
     const first=await tx.noteSource.findFirst({where:{noteId:link.noteId},orderBy:{source:{createdAt:'asc'}}});
     await tx.note.update({where:{id:link.noteId},data:{...(first?.sourceId===id&&first.itemKey===link.itemKey?{explanation}:{}),updatedAt:new Date()}});
    });
   }
  }
 }
 const complete=!answerError&&imageCount===s.attachments.length&&s.disposition!=='pending'&&(s.disposition==='non_learning'||s.links.length>0)&&linked&&!!answer;
 return db.$transaction(async tx=>{
  const updated=await tx.source.update({where:{id},data:{status:complete?'complete':'incomplete',error:errors.length?errors.join('\n'):!answer?'讲解尚未完成':s.disposition==='pending'?'等待整理':!linked?unlinkedImagesError:answerError}});
  if(complete&&s.disposition==='learning'&&!s.activityTracked){
   await tx.learningActivity.upsert({where:{id:'archive:'+id},create:{id:'archive:'+id,kind:'archive',sourceId:id},update:{}});
   return tx.source.update({where:{id},data:{activityTracked:true}});
  }
  return updated;
 });
}
export async function record(input:unknown){
 const data=recordSchema.parse(input);let s=await collect(data.threadId,data.turnId);
 const source=await db.source.findUniqueOrThrow({where:{id:s.id},include:{attachments:true}});
 const valid=new Set(source.attachments.map(a=>a.id));
 const itemKeys=new Set(data.items.map(i=>i.itemKey));
 if(itemKeys.size!==data.items.length)throw new Error('同一轮次的 itemKey 不得重复');
 const finalItems=data.items.filter(i=>i.captureMode==='final');
 if(data.items.length>1&&finalItems.some(i=>!i.answerHeading))throw new Error('多题最终回答必须为每题指定唯一二级标题 answerHeading');
 if(new Set(finalItems.map(i=>i.answerHeading)).size!==finalItems.length)throw new Error('每题的 answerHeading 不得重复');
 for(const item of data.items){if(item.attachmentIds.some(id=>!valid.has(id)))throw new Error('图片引用必须属于当前来源');if(source.attachments.length&&!item.attachmentIds.length)throw new Error('有图片的题目必须指定来源附件');
  if(!source.attachments.length&&item.knowledgePoints.some(point=>point.signal==='confirmed'&&!source.question.replace(/\s/g,'').includes(point.evidence.replace(/\s/g,''))))throw new Error('确认理解必须引用本轮用户的真实表达，不能使用老师的判断');
 }
 const visuals=await Promise.all(data.items.map(item=>preserveVisualizations(item.visualizations)));
 await db.$transaction(async tx=>{
  for(const [index,item] of data.items.entries()){const existing=await tx.noteSource.findUnique({where:{sourceId_itemKey:{sourceId:s.id,itemKey:item.itemKey}}});
   let noteId=existing?.noteId||item.noteId;
   if(noteId){const n=await tx.note.findUnique({where:{id:noteId},include:noteInclude});if(!n||n.ownerId!=='local'||!n.sources.some(l=>l.source.threadId===data.threadId))throw new Error('追问只能关联当前会话已有笔记');const first=n.sources[0];const root=first?.sourceId===s.id&&first.itemKey===item.itemKey;await tx.note.update({where:{id:noteId},data:{autoTags:JSON.stringify([...new Set([...JSON.parse(n.autoTags),...item.tags])]),...(root?{autoTitle:item.title,autoSubject:item.subject,question:item.question,explanation:embedVisualizations(item.explanation,visuals[index])}:{}),updatedAt:new Date()}})}
   else{noteId=randomUUID();await tx.note.create({data:{id:noteId,autoTitle:item.title,autoSubject:item.subject,autoTags:JSON.stringify(item.tags),kind:item.kind,question:item.question,explanation:embedVisualizations(item.explanation,visuals[index]),questionNumber:item.questionNumber}})}
   await tx.noteSource.upsert({where:{sourceId_itemKey:{sourceId:s.id,itemKey:item.itemKey}},create:{noteId,sourceId:s.id,itemKey:item.itemKey,question:item.question,explanation:embedVisualizations(item.explanation,visuals[index]),attachmentIds:JSON.stringify(item.attachmentIds),captureMode:item.captureMode,answerHeading:item.answerHeading,knowledgePoints:JSON.stringify(item.knowledgePoints),visuals:JSON.stringify(visuals[index])},update:{question:item.question,explanation:embedVisualizations(item.explanation,visuals[index]),attachmentIds:JSON.stringify(item.attachmentIds),captureMode:item.captureMode,answerHeading:item.answerHeading,knowledgePoints:JSON.stringify(item.knowledgePoints),visuals:JSON.stringify(visuals[index])}});
  }
  await tx.source.update({where:{id:s.id},data:{disposition:data.disposition}});
 });
 s=await collect(data.threadId,data.turnId);
 return {source:s,notes:(await db.note.findMany({where:{sources:{some:{sourceId:s.id}}},include:noteInclude})).map(presentNote)};
}
let running=false;
export async function workQueue(){if(running)return;running=true;try{
 for(const file of await readdir(queueRoot)){
  if(!file.endsWith('.json'))continue;
  const claimed=file.endsWith('.processing.json')?resolve(queueRoot,file):resolve(queueRoot,`${file}.${randomUUID()}.processing.json`);
  try{
   // Rename before reading: a concurrently enriched spool file must remain for the next pass.
   if(!file.endsWith('.processing.json'))await rename(resolve(queueRoot,file),claimed);
   const payload=JSON.parse(await readFile(claimed,'utf8'));
   await enqueue(payload);
   await unlink(claimed);
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')console.error('队列导入失败',file,(e as Error).message)}
 }
 const events=await db.archiveEvent.findMany({where:{status:{in:['pending','retry']}},orderBy:{createdAt:'asc'},take:20});
 for(const e of events){const input=eventSchema.parse(JSON.parse(e.payload));try{
  if(input.turn_id)await collect(input.session_id,input.turn_id,input.last_assistant_message,input.snapshot);
  else{reader??=new CodexReader();const t=await reader.read(input.session_id);if(!sameDirectory(t.cwd,learningRoot))throw new Error('项目不匹配');for(const turn of t.turns)await collect(t.id,turn.id)}
  await db.archiveEvent.update({where:{id:e.id},data:{status:'done',error:null,attempts:{increment:1}}});
 }catch(error){await db.archiveEvent.update({where:{id:e.id},data:{status:e.attempts>=9?'failed':'retry',error:(error as Error).message,attempts:{increment:1}}})}}
}finally{running=false}}
export function closeReader(){reader?.close();reader=undefined}
