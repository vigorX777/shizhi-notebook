import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {root,baseUrl,token} from '../server/config.js';
// Upgrade only sources already recorded by this learning project, through its service.
const notes=await (await fetch(baseUrl+'/api/v1/notes')).json();
const {sources}=await (await fetch(baseUrl+'/api/v1/status')).json();
const report=[];
for(const source of sources){
 if(source.disposition!=='learning'||source.links.length!==1)continue;
 const link=source.links[0];if(link.captureMode==='final')continue;
 const note=notes.find((n:any)=>n.id===link.noteId);if(!note)continue;
 const response=await fetch(baseUrl+'/api/v1/archive/record',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({threadId:source.threadId,turnId:source.turnId,disposition:'learning',items:[{itemKey:link.itemKey,noteId:note.id,title:note.autoTitle,kind:note.kind,subject:note.autoSubject,tags:JSON.parse(note.autoTags),question:link.question,explanation:link.explanation,attachmentIds:JSON.parse(link.attachmentIds),captureMode:'final',knowledgePoints:JSON.parse(link.knowledgePoints)}]})});
 const result=await response.json();if(!response.ok)throw new Error(result.error);
 report.push({noteId:note.id,sourceId:source.id,status:result.source.status,finalCharacters:result.source.answer.length});
}
await mkdir(join(root,'.local'),{recursive:true});await writeFile(join(root,'.local/final-answer-refresh.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
