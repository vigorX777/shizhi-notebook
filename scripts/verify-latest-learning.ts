import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {db,noteInclude,presentNote} from '../server/db.js';
import {attachmentsRoot,root} from '../server/config.js';
import {CodexReader} from '../server/codex.js';
import {answerSection} from '../server/learning-content.js';
import {embedVisualizations,storedVisualsSchema} from '../server/visualizations.js';
const threadId=process.argv[2];if(!threadId)throw new Error('需要指定已知学习会话 ID');
const reader=new CodexReader();
try{
 const sources=await db.source.findMany({where:{threadId},include:{attachments:true,links:true}});assert.ok(sources.length,'会话不在学习来源中');
 const thread=await reader.read(threadId);const report=[];
 for(const source of sources){
  const turn=thread.turns.find((t:any)=>t.id===source.turnId);assert.ok(turn);
  const inputs=turn.items.filter((item:any)=>item.type==='userMessage').flatMap((item:any)=>item.content);
  const images=inputs.map((input:any,index:number)=>({input,index})).filter(({input}:any)=>['image','localImage'].includes(input.type));
  assert.equal(images.length,source.attachments.length);const attachments=[];
  for(const {input,index} of images){const attachment=source.attachments.find(a=>a.inputIndex===index);assert.ok(attachment);const saved=await readFile(join(attachmentsRoot,attachment.filename));const digest=createHash('sha256').update(saved).digest('hex');assert.equal(digest,attachment.sha256);if(input.type==='localImage')assert.equal(createHash('sha256').update(await readFile(input.path)).digest('hex'),digest);attachments.push({id:attachment.id,inputIndex:index,bytes:saved.length,sha256:digest,originalMatched:true,...(attachment.mime==='image/png'?{width:saved.readUInt32BE(16),height:saved.readUInt32BE(20)}:{})})}
  const notes=[];
  for(const link of source.links){const section=answerSection(source.answer,link.answerHeading);assert.ok(section);assert.equal(link.explanation,embedVisualizations(section,storedVisualsSchema.parse(JSON.parse(link.visuals))));const note=presentNote(await db.note.findUniqueOrThrow({where:{id:link.noteId},include:noteInclude}));notes.push({id:note.id,subject:note.subject,questionNumber:note.questionNumber,attachmentIds:JSON.parse(link.attachmentIds),finalSectionMatches:true,hasInteractiveVisualization:link.visuals!=='[]'||/```learning-html|visualize/.test(link.explanation),learningRounds:note.sources.length,knowledgePoints:note.knowledgePoints.map((point:any)=>({label:point.label,rounds:point.rounds,signal:point.signal}))})}
  report.push({sourceId:source.id,turnId:source.turnId,sourceStatus:source.status,turnStatus:turn.status,images:attachments,notes});
 }
 const result={checkedAt:new Date().toISOString(),threadId,passed:true,operationEvidence:'real user reported submission; clipboard-origin paths, not proof of a Finder drag gesture',sources:report};await writeFile(join(root,'.local/latest-learning-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{reader.close();await db.$disconnect()}
