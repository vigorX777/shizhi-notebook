import assert from 'node:assert/strict';
import {mkdtemp,readFile,rename,writeFile,access,rmdir} from 'node:fs/promises';
import {join,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {db} from '../server/db.js';
import {baseUrl,root,dataRoot} from '../server/config.js';
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const exists=async(path:string)=>{try{await access(path);return true}catch{return false}};
const held=await mkdtemp(join(tmpdir(),'shizhi-original-hold-'));
const moved:{original:string;held:string;sha256:string}[]=[];
const report:any={checkedAt:new Date().toISOString(),sourcesFromExistingNotebook:true,desktopInputValidatedByScript:false,codexClosed:false,networkDisconnected:false,sources:[],restored:false};
try{
 const health=await fetch(baseUrl+'/api/v1/health');assert.equal(health.status,200);
 const sources=await db.source.findMany({where:{status:'complete',disposition:'learning'},include:{attachments:true,links:true}});
 assert.ok(sources.length,'没有完整真实学习来源可验证');
 for(const source of sources){
  const inputs=JSON.parse(source.raw);const originals=[];
  for(const attachment of source.attachments){
   const input=inputs[attachment.inputIndex];assert.ok(input&&['image','localImage'].includes(input.type));
   const original=input.type==='localImage'?resolve(input.path):null;
   if(original?.startsWith(resolve(dataRoot)+'/')){originals.push({attachmentId:attachment.id,state:'managed-ingress-reference'});continue}
   if(original&&await exists(original)){
    // Only hide unique Codex clipboard upload files, never arbitrary student files.
    assert.ok(original.startsWith(resolve(tmpdir())+'/')&&/^codex-clipboard-[a-f0-9-]+\.png$/i.test(basename(original)),'原文件不是可安全临时移走的 Codex clipboard 文件');
    assert.equal(sha(await readFile(original)),attachment.sha256,'原上传文件摘要已变化');
    const target=join(held,basename(original));await rename(original,target);moved.push({original,held:target,sha256:attachment.sha256});
    assert.equal(await exists(original),false);originals.push({attachmentId:attachment.id,state:'temporarily-moved'});
   }else originals.push({attachmentId:attachment.id,state:original?'already-absent':'embedded-source'});
  }
  const checked=[];
  for(const attachment of source.attachments){
   const response=await fetch(baseUrl+'/api/v1/attachments/'+attachment.id);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),attachment.mime);
   const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(bytes.length,attachment.bytes);assert.equal(sha(bytes),attachment.sha256);
   checked.push({id:attachment.id,bytes:bytes.length,sha256:sha(bytes),servedWithoutOriginal:true});
  }
  for(const link of source.links){
   const response=await fetch(baseUrl+'/api/v1/notes/'+link.noteId);assert.equal(response.status,200);const note=await response.json();assert.ok(note.complete);assert.ok(note.explanation);
   if(source.links.length===1&&link.captureMode==='final'&&!link.answerHeading&&link.visuals==='[]')assert.equal(link.explanation,source.answer);
  }
  report.sources.push({sourceId:source.id,threadId:source.threadId,turnId:source.turnId,originals,originalFileIndependenceVerified:originals.every(item=>item.state!=='managed-ingress-reference'),attachments:checked,notes:source.links.map(link=>link.noteId)});
 }
}finally{
 for(const item of moved.reverse()){
  // Do not overwrite a file that another process recreated during verification.
  if(await exists(item.original))throw new Error('原路径被重新创建，保留暂存原图：'+item.held);
  await rename(item.held,item.original);assert.equal(sha(await readFile(item.original)),item.sha256);
 }
 report.restored=true;await rmdir(held);await db.$disconnect();
}
report.passed=report.sources.every((source:any)=>source.originalFileIndependenceVerified);
await writeFile(join(root,'.local/original-independence-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
