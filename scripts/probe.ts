import {CodexReader} from '../server/codex.js';
if(!process.argv[2])throw new Error('用法：npm run probe -- <专用 learning 会话ID>；不默认读取其他会话');
const reader=new CodexReader();
try{const t=await reader.read(process.argv[2]);console.log(JSON.stringify({id:t.id,cwd:t.cwd,turns:t.turns.map((x:any)=>({id:x.id,status:x.status,items:x.items.filter((i:any)=>['userMessage','agentMessage'].includes(i.type)).map((i:any)=>({type:i.type,phase:i.phase,content:i.content?.map((c:any)=>c.type==='text'?{type:c.type,length:c.text.length}:{...c,url:c.url?.slice(0,90)}),textLength:i.text?.length}))}))},null,2))}finally{reader.close()}
