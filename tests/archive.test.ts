import {runPrisma} from '../shared/runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {zipSync,unzipSync,strToU8} from 'fflate';
const dir=mkdtempSync(join(tmpdir(),'shizhi-tests-'));process.env.SHIZHI_DATA_DIR=dir;process.env.SHIZHI_PORT='47839';
writeFileSync(join(dir,'notebook.db'),'');
const setup=runPrisma(['db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:'file:'+join(dir,'notebook.db')},encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);
const {CodexReader}=await import('../server/codex.js');
const {db}=await import('../server/db.js');
const {learningRoot,attachmentsRoot,queueRoot}=await import('../server/config.js');
const {enqueue,workQueue,collect,record,sourceId,closeReader}=await import('../server/archive.js');
const {exportBackup,restoreBackup,validateBackup}=await import('../server/backup.js');
// Fixtures match generated official UserInput/ThreadItem shapes; these are not desktop acceptance evidence.
const original=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4S8AAAAASUVORK5CYII=','base64');
const image=join(dir,'upload.png');writeFileSync(image,original);
let turns:any[]=[{id:'turn-1',items:[{type:'userMessage',content:[{type:'text',text:'求 2x+3=7 的解',text_elements:[]},{type:'localImage',path:image}]},{type:'agentMessage',phase:'final_answer',text:'移项得到 $x=2$。'}]}];
CodexReader.prototype.read=async()=>({id:'thread-fixture',cwd:learningRoot,turns});
const input=(turnId:string,extra:any={})=>({threadId:'thread-fixture',turnId,disposition:'learning',items:[{itemKey:'q1',captureMode:'snapshot',title:'一元一次方程',kind:'question',subject:'数学',tags:['方程'],question:'求 2x+3=7 的解',explanation:'移项得到 $x=2$。',attachmentIds:[],...extra}]});
test('归档闭环：重复、追问、人工保护、缺图、备份、离线队列',async()=>{
 try{
  const event={session_id:'thread-fixture',turn_id:'turn-1',cwd:learningRoot,hook_event_name:'Stop'};
  await enqueue(event);await enqueue(event);await workQueue();assert.equal(await db.archiveEvent.count(),1);assert.equal(await db.source.count(),1);
  const attachment=await db.attachment.findFirstOrThrow();assert.deepEqual(readFileSync(join(attachmentsRoot,attachment.filename)),original);
  const first=await record(input('turn-1',{attachmentIds:[attachment.id]}));assert.equal(first.source.status,'complete');const id=first.notes[0].id;
  await record(input('turn-1',{attachmentIds:[attachment.id]}));assert.equal(await db.note.count(),1);assert.equal(await db.learningActivity.count(),1);
  await db.note.update({where:{id},data:{manualTitle:'我的方程题',manualSubject:'代数',manualTags:'["移项"]',reflection:'先移项再除系数',wrong:true,wrongReason:'忘记变号',mastery:'review'}});
  turns.push({id:'turn-2',items:[{type:'userMessage',content:[{type:'text',text:'为什么移项变号？'}]},{type:'agentMessage',phase:'final_answer',text:'等式两边同时减去 3。'}]});
  await record(input('turn-2',{noteId:id,question:'为什么移项变号？',explanation:'等式两边同时减去 3。'}));assert.equal(await db.note.count(),1);assert.equal(await db.noteSource.count(),2);
  const n=await db.note.findUniqueOrThrow({where:{id}});assert.equal(n.manualTitle,'我的方程题');assert.equal(n.manualSubject,'代数');assert.equal(n.reflection,'先移项再除系数');assert.equal(n.mastery,'review');assert.equal(n.wrong,true);
  turns.push({id:'turn-3',items:[{type:'userMessage',content:[{type:'text',text:'谢谢'}]},{type:'agentMessage',phase:'final_answer',text:'不客气'}]});await record({threadId:'thread-fixture',turnId:'turn-3',disposition:'non_learning',items:[]});assert.equal(await db.note.count(),1);
  turns.push({id:'turn-missing',items:[{type:'userMessage',content:[{type:'localImage',path:'/tmp/shizhi-does-not-exist.png'}]},{type:'agentMessage',phase:'final_answer',text:'讲解'}]});await record(input('turn-missing'));const missing=await db.source.findUniqueOrThrow({where:{id:sourceId('thread-fixture','turn-missing')}});assert.equal(missing.status,'incomplete');assert.match(missing.error!,/图片/);
  turns.push({id:'turn-interrupted',items:[{type:'userMessage',content:[{type:'text',text:'求三角形面积'}]}]});const interrupted=await collect('thread-fixture','turn-interrupted');assert.equal(interrupted.question,'求三角形面积');assert.equal(interrupted.status,'incomplete');assert.equal(interrupted.answer,'');assert.equal(await db.learningActivity.count(),2);
  const activitiesBefore=await db.learningActivity.findMany({orderBy:{id:'asc'}});
  const before=await db.note.findMany({orderBy:{id:'asc'}});const backup=await exportBackup();validateBackup(backup);
  const files=unzipSync(backup);delete files['attachments/'+attachment.filename];assert.throws(()=>validateBackup(Buffer.from(zipSync(files))),/图片缺失/);
  const malicious=unzipSync(backup);malicious['../evil']=strToU8('no');assert.throws(()=>validateBackup(Buffer.from(zipSync(malicious))),/未知文件/);
  const restored=await restoreBackup(backup);assert.deepEqual(await db.learningActivity.findMany({orderBy:{id:'asc'}}),activitiesBefore);assert.equal(restored.notes,2);assert.deepEqual(await db.note.findMany({orderBy:{id:'asc'}}),before);assert.deepEqual(readFileSync(join(attachmentsRoot,attachment.filename)),original);
  // Prove an offline hook retains original bytes from a formal-protocol fixture, even after upload removal.
  const fakeCli=join(dir,'fixture-codex.cjs');
  const snapshot={id:'thread-fixture',cwd:learningRoot,turns:[{id:'turn-offline-image',items:[{type:'userMessage',content:[{type:'localImage',path:image}]},{type:'agentMessage',phase:'final_answer',text:'离线图片讲解'}]}]};
  writeFileSync(fakeCli,'#!'+process.execPath+'\n'+`const {createInterface}=require('node:readline');createInterface({input:process.stdin}).on('line',l=>{const r=JSON.parse(l);if(r.id)console.log(JSON.stringify({id:r.id,result:r.method==='initialize'?{}:{thread:${JSON.stringify(snapshot)}}}));});`,{mode:0o700});
  const offlineImage=spawnSync(process.execPath,['scripts/hook.mjs'],{input:JSON.stringify({...event,turn_id:'turn-offline-image'}),env:{...process.env,CODEX_BIN:fakeCli},encoding:'utf8'});assert.equal(offlineImage.status,0);unlinkSync(image);await workQueue();
  const preserved=await db.source.findUniqueOrThrow({where:{id:sourceId('thread-fixture','turn-offline-image')},include:{attachments:true}});assert.equal(preserved.attachments.length,1);assert.deepEqual(readFileSync(join(attachmentsRoot,preserved.attachments[0].filename)),original);assert.equal(preserved.answer,'离线图片讲解');
  // Service is intentionally absent on this port. Hook must spool rather than discard.
  const hook=spawnSync(process.execPath,['scripts/hook.mjs'],{input:JSON.stringify({...event,turn_id:'turn-offline',hook_event_name:'UserPromptSubmit',prompt:'离线保留'}),env:process.env,encoding:'utf8'});assert.equal(hook.status,0);assert.match(hook.stdout,/事件已保留/);
  turns.push({id:'turn-offline',items:[{type:'userMessage',content:[{type:'text',text:'离线保留'}]}]});await workQueue();assert.equal((await db.source.findUniqueOrThrow({where:{id:sourceId('thread-fixture','turn-offline')}})).question,'离线保留');
  await assert.rejects(()=>enqueue({...event,cwd:'/tmp/other-project'}),/专用学习项目/);
  // One image / two questions and two images / two subjects: shared and separate IDs are retained.
  const managedPath=join(attachmentsRoot,attachment.filename);
  turns.push({id:'turn-multi',items:[{type:'userMessage',content:[{type:'localImage',path:managedPath},{type:'localImage',path:managedPath}]},{type:'agentMessage',phase:'final_answer',text:'两题分别讲解'}]});
  await collect('thread-fixture','turn-multi');const pics=await db.attachment.findMany({where:{sourceId:sourceId('thread-fixture','turn-multi')},orderBy:{inputIndex:'asc'}});
  const multi=await record({threadId:'thread-fixture',turnId:'turn-multi',disposition:'learning',items:[input('turn-multi',{itemKey:'math',attachmentIds:[pics[0].id]}).items[0],input('turn-multi',{itemKey:'english',title:'一般过去时',subject:'英语',attachmentIds:[pics[1].id]}).items[0]]});assert.equal(multi.notes.length,2);assert.equal(multi.source.status,'complete');assert.notEqual(multi.notes[0].id,multi.notes[1].id);
  turns.push({id:'turn-shared',items:[{type:'userMessage',content:[{type:'localImage',path:managedPath}]},{type:'agentMessage',phase:'final_answer',text:'同图两题'}]});await collect('thread-fixture','turn-shared');const shared=await db.attachment.findFirstOrThrow({where:{sourceId:sourceId('thread-fixture','turn-shared')}});
  const same=await record({threadId:'thread-fixture',turnId:'turn-shared',disposition:'learning',items:[input('turn-shared',{itemKey:'1',questionNumber:'1',attachmentIds:[shared.id]}).items[0],input('turn-shared',{itemKey:'2',questionNumber:'2',attachmentIds:[shared.id]}).items[0]]});assert.equal(same.notes.length,2);assert.ok(same.notes.every(n=>n.sources[0].attachmentIds[0]===shared.id));
  // A base event may already be processed before the hook captures an independently held original.
  const lateTurn={id:'turn-late-image',items:[{type:'userMessage',content:[{type:'localImage',path:'/tmp/shizhi-upload-already-removed.png'}]},{type:'agentMessage',phase:'final_answer',text:'晚到图片讲解'}]};
  turns.push(lateTurn);
  const lateEvent={...event,turn_id:lateTurn.id};
  await record(input(lateTurn.id));
  const baseEvent=await enqueue(lateEvent);await workQueue();
  assert.equal((await db.archiveEvent.findUniqueOrThrow({where:{id:baseEvent.id}})).status,'done');
  const heldTurn=structuredClone(lateTurn);heldTurn.items[0].content![0].path=managedPath;
  const enriched={...lateEvent,snapshot:{id:'thread-fixture',cwd:learningRoot,capturedAt:2,turns:[heldTurn]}};
  assert.equal((await enqueue(enriched)).status,'pending');await workQueue();
  const lateSource=await db.source.findUniqueOrThrow({where:{id:sourceId('thread-fixture',lateTurn.id)},include:{attachments:true}});
  assert.equal(lateSource.attachments.length,1);assert.equal(lateSource.status,'incomplete');assert.match(lateSource.error!,/尚未关联/);
  // Replaying either version must retain the richer snapshot without duplicating the event or image.
  assert.equal((await enqueue(enriched)).status,'done');assert.equal((await enqueue(lateEvent)).status,'done');
  const stale=await enqueue({...lateEvent,snapshot:{id:'thread-fixture',cwd:learningRoot,capturedAt:1,turns:[lateTurn]}});
  assert.equal(stale.status,'done');assert.equal(JSON.parse(stale.payload).snapshot.capturedAt,2);
  assert.equal(await db.archiveEvent.count({where:{id:baseEvent.id}}),1);
  const lateRecord=await record(input(lateTurn.id,{attachmentIds:[lateSource.attachments[0].id]}));assert.equal(lateRecord.source.status,'complete');
  // A crash after claiming but before DB insertion leaves a processing file recoverable on restart.
  writeFileSync(join(queueRoot,'recovered.processing.json'),JSON.stringify({...event,turn_id:'turn-3'}));await workQueue();assert.equal(existsSync(join(queueRoot,'recovered.processing.json')),false);
  const promptRace={...event,hook_event_name:'UserPromptSubmit',turn_id:'turn-3',snapshot:{id:'thread-fixture',cwd:learningRoot,turns:[{id:'turn-3',items:[]}]}};
  const promptEvent=await enqueue(promptRace);await workQueue();assert.equal((await db.archiveEvent.findUniqueOrThrow({where:{id:promptEvent.id}})).status,'done');
  // HTTP contracts: Stop repair is at most once, user edits round-trip, and invalid restore is atomic.
  const {app}=await import('../server/index.js');const {baseUrl,token}=await import('../server/config.js');
  try{
   const post=async(path:string,body:any,archive=false)=>{const r=await fetch(baseUrl+'/api/v1/'+path,{method:'POST',headers:{'content-type':'application/json',...(archive?{authorization:'Bearer '+token}:{'x-shizhi-client':'web'})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
   const context=await post('archive/context',{threadId:'thread-fixture'},true);assert.equal(context.status,200);assert.equal(context.data.source.turnId,turns.at(-1).id);
   const check={threadId:'thread-fixture',turnId:'turn-offline',active:false};assert.equal((await post('archive/check',check,true)).data.needsRepair,true);assert.equal((await post('archive/check',check,true)).data.needsRepair,false);
   turns.push({id:'turn-visual-repair',items:[{type:'userMessage',content:[{type:'text',text:'请画图'}]},{type:'agentMessage',phase:'final_answer',text:'![图](https://example.com/temporary.png)'}]});
   const incompleteVisual=await record(input('turn-visual-repair',{captureMode:'final'}));assert.equal(incompleteVisual.source.status,'incomplete');
   const visualCheck={threadId:'thread-fixture',turnId:'turn-visual-repair',active:false};assert.equal((await post('archive/check',visualCheck,true)).data.needsRepair,true);assert.equal((await post('archive/check',visualCheck,true)).data.needsRepair,false);
   const highlights=[{id:'45374267-4321-4123-8123-123456789012',contentKey:'main',exact:'移项',prefix:'',suffix:'',start:0}];
   const marked=await fetch(baseUrl+'/api/v1/notes/'+id,{method:'PATCH',headers:{'content-type':'application/json','x-shizhi-client':'web'},body:JSON.stringify({highlights,mastery:'mastered'})});assert.equal(marked.status,200);assert.deepEqual((await marked.json()).highlights,highlights);
   await record(input('turn-2',{noteId:id,question:'为什么移项变号？',explanation:'等式两边同时减去 3。'}));assert.deepEqual(JSON.parse((await db.note.findUniqueOrThrow({where:{id}})).highlights),highlights);assert.equal((await db.note.findUniqueOrThrow({where:{id}})).mastery,'mastered');
   const annotationBackup=await exportBackup();await restoreBackup(annotationBackup);assert.deepEqual(JSON.parse((await db.note.findUniqueOrThrow({where:{id}})).highlights),highlights);
   const updated=await fetch(baseUrl+'/api/v1/notes/'+id,{method:'PATCH',headers:{'content-type':'application/json','x-shizhi-client':'web'},body:JSON.stringify({title:'HTTP 编辑标题',mastery:'mastered'})});assert.equal(updated.status,200);assert.equal((await updated.json()).title,'HTTP 编辑标题');
   assert.equal((await fetch(baseUrl+'/api/v1/health',{headers:{Origin:'https://evil.example'}})).status,403);assert.equal((await post('archive/check',check)).status,401);
   assert.equal((await fetch(baseUrl+'/api/v1/notes/'+id,{method:'PATCH',headers:{'content-type':'application/json','x-shizhi-client':'web'},body:JSON.stringify({autoTitle:'禁止写入自动字段'})})).status,400);
   const still=await db.note.findMany({orderBy:{id:'asc'}});const bad=new FormData();bad.append('backup',new Blob([zipSync(files)]),'bad.zip');const restore=await fetch(baseUrl+'/api/v1/restore',{method:'POST',headers:{'x-shizhi-client':'web'},body:bad});assert.equal(restore.status,400);assert.deepEqual(await db.note.findMany({orderBy:{id:'asc'}}),still);
  }finally{await app.close()}

  const oldFiles=unzipSync(await exportBackup());const oldManifest=JSON.parse(new TextDecoder().decode(oldFiles['manifest.json']));delete oldManifest.activities;for(const source of oldManifest.sources)delete source.activityTracked;oldFiles['manifest.json']=strToU8(JSON.stringify(oldManifest));await restoreBackup(Buffer.from(zipSync(oldFiles)));assert.equal(await db.learningActivity.count(),0);await record(input('turn-1',{attachmentIds:[attachment.id]}));assert.equal(await db.learningActivity.count(),0,'旧包重读不得伪造今日归档活动');turns.find(turn=>turn.id==='turn-interrupted').items.push({type:'agentMessage',phase:'final_answer',text:'面积等于底乘高除以二。'});await record(input('turn-interrupted',{question:'求三角形面积',explanation:'面积等于底乘高除以二。'}));assert.equal(await db.learningActivity.count(),1,'旧未完成来源真正补齐应点亮今日足迹');
  console.log('测试数据目录：'+dir);
 }finally{closeReader();await db.$disconnect()}
});
