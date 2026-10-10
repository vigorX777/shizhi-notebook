import './config.js';
import {PrismaClient} from '@prisma/client';
import {summarizeKnowledge} from './learning-content.js';
export const db=new PrismaClient();
export const noteInclude={sources:{orderBy:{source:{createdAt:'asc'}},include:{source:{include:{attachments:true}}}}} as const;
export function presentNote(n:any){return {...n,highlights:JSON.parse(n.highlights),title:n.manualTitle??n.autoTitle,subject:n.manualSubject??n.autoSubject,tags:JSON.parse(n.manualTags??n.autoTags),sources:n.sources.map((s:any)=>({...s,attachmentIds:JSON.parse(s.attachmentIds),knowledgePoints:JSON.parse(s.knowledgePoints)})),knowledgePoints:summarizeKnowledge(n.sources),complete:n.sources.every((s:any)=>s.source.status==='complete')};}
