import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {db} from '../server/db.js';
import {root,attachmentsRoot} from '../server/config.js';
try{const sources=await db.source.findMany({include:{attachments:true,links:true}});const report={checkedAt:new Date().toISOString(),sourceCount:sources.length,noteCount:await db.note.count(),desktopAcceptance:'requires recorded real desktop operations; counts alone do not prove acceptance',sources:sources.map(s=>({threadId:s.threadId,turnId:s.turnId,status:s.status,disposition:s.disposition,error:s.error,notes:s.links.map(l=>l.noteId),attachments:s.attachments.map(a=>{let valid=false;try{valid=createHash('sha256').update(readFileSync(join(attachmentsRoot,a.filename))).digest('hex')===a.sha256}catch{}return {id:a.id,bytes:a.bytes,sha256:a.sha256,valid}})}))};mkdirSync(join(root,'.local'),{recursive:true});writeFileSync(join(root,'.local','live-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!sources.length||sources.some(s=>s.status!=='complete'))process.exitCode=1}finally{await db.$disconnect()}
