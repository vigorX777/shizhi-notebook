import {readFileSync,writeFileSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {defaultDataRoot,loadMachineEnvironment,sameDirectory} from '../shared/runtime.mjs';
loadMachineEnvironment();
const root=resolve(import.meta.dirname,'..','learning');
const data=defaultDataRoot();
const base=`http://127.0.0.1:${process.env.SHIZHI_PORT||47831}`;
let e;try{e=JSON.parse(readFileSync(0,'utf8'))}catch{process.exit(0)}
if(!sameDirectory(e.cwd||'.',root))process.exit(0);
// Never read transcript_path. Durable ingress precedes network and survives a stopped service.
const payload={session_id:e.session_id,turn_id:e.turn_id,cwd:e.cwd,hook_event_name:e.hook_event_name,prompt:e.prompt,stop_hook_active:e.stop_hook_active,last_assistant_message:e.last_assistant_message};
const queue=join(data,'queue');mkdirSync(queue,{recursive:true,mode:0o700});const id=createHash('sha256').update(`${e.session_id}:${e.turn_id||''}:${e.hook_event_name}`).digest('hex');const temp=join(queue,randomUUID()+'.tmp');const target=join(queue,id+'-'+randomUUID()+'.json');writeFileSync(temp,JSON.stringify(payload),{mode:0o600});renameSync(temp,target);
// Preserve official input and full original bytes even when the HTTP service is offline.
// The snapshot remains narrowly scoped to this event's turn, never another conversation.
try{
 const {CodexReader}=await import('../server/codex.ts');const reader=new CodexReader();
 try{
  const t=await reader.read(e.session_id);const turn=t.turns.find(t=>t.id===e.turn_id);
  if(sameDirectory(t.cwd,root)&&turn){
   const copied=structuredClone(turn);copied.items=copied.items.filter(i=>['userMessage','agentMessage'].includes(i.type));
   for(const item of copied.items)for(const input of item.content||[]){
    if(input.type!=='localImage'&&input.type!=='image')continue;
    try{let bytes;if(input.type==='localImage')bytes=readFileSync(input.path);else if(input.url?.startsWith('data:image/'))bytes=Buffer.from(input.url.split(',')[1],'base64');else continue;
     if(!bytes.length||bytes.length>30*1024*1024)continue;
     const sha=createHash('sha256').update(bytes).digest('hex');const originals=join(data,'ingress-originals');mkdirSync(originals,{recursive:true,mode:0o700});const path=join(originals,sha);const imageTemp=join(originals,randomUUID()+'.tmp');writeFileSync(imageTemp,bytes,{mode:0o600});renameSync(imageTemp,path);input.type='localImage';input.path=path;delete input.url;delete input.fileId;
    }catch{} // Service will expose a concrete missing-original error; never mark complete here.
   }
   payload.snapshot={id:t.id,cwd:t.cwd,capturedAt:Date.now(),turns:[copied]};const temp2=join(queue,randomUUID()+'.tmp');writeFileSync(temp2,JSON.stringify(payload),{mode:0o600});renameSync(temp2,target);
  }
 }finally{reader.close()}
}catch{} // Initial durable event is already safe; recovery can retry official thread/read.
let warning;
try{const token=readFileSync(join(data,'archive-token'),'utf8').trim();const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(e.hook_event_name==='Stop'?22000:1800)});if(!r.ok)throw new Error((await r.json()).error);return r.json()};
 await post('/api/v1/archive/event',payload);try{unlinkSync(target)}catch{}
 if(e.hook_event_name==='Stop'&&e.turn_id){const check=await post('/api/v1/archive/check',{threadId:e.session_id,turnId:e.turn_id,active:!!e.stop_hook_active});if(check.needsRepair){console.log(JSON.stringify({decision:'block',reason:`本轮学习内容还未整理。使用 get_learning_context(threadId="${e.session_id}",turnId="${e.turn_id}") 后调用 record_learning_items；非学习消息提交 non_learning 和空 items。只补整理一次，不重复讲解。`}));process.exit(0)}}
}catch(error){warning='学习归档未完成：'+error.message+'。原始事件已保留，服务恢复后重试。'}
if(e.hook_event_name==='UserPromptSubmit')console.log(JSON.stringify({...(warning?{systemMessage:warning}:{}),hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:`本轮归档来源 threadId=${e.session_id}${e.turn_id?`，turnId=${e.turn_id}`:'；turnId 未提供，请省略该参数并使用工具返回的 source.turnId'}。先用 get_learning_context 查看原始内容及附件 ID，再调用 record_learning_items 整理。归档请求失败不改变这些来源 ID。`}}));
else if(warning)console.log(JSON.stringify({systemMessage:warning}));else console.log('{}');
