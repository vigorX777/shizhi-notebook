import {z} from 'zod';

export const knowledgePointSchema=z.object({
 label:z.string().trim().min(1).max(100),
 summary:z.string().trim().min(1).max(2000),
 signal:z.enum(['discussed','confused','confirmed','corrected']),
 evidence:z.string().trim().min(1).max(1000)
});
export const knowledgePointsSchema=z.array(knowledgePointSchema).max(30).superRefine((points,context)=>{
 const labels=points.map(point=>point.label.normalize('NFKC').replace(/\s/g,'').toLocaleLowerCase());
 if(new Set(labels).size!==labels.length)context.addIssue({code:'custom',message:'同一轮同一题的知识点名称不得重复'});
});

// Multi-question answers use visible level-two headings, so no invisible markers
// or second model call is needed to keep the final response and each note equal.
export function answerSection(answer:string,heading:string){
 if(!heading)return answer;
 const lines=answer.split('\n');
 let fence='';const sections:{index:number;title:string}[]=[];
 for(let index=0;index<lines.length;index++){
  const line=lines[index];const marker=line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence='';continue}
  if(fence)continue;
  if(/^##\s+/.test(line))sections.push({index,title:line.replace(/^##\s+/,'').trim().replace(/\s+#+$/,'')});
 }
 const matches=sections.filter(section=>section.title===heading);if(matches.length!==1)return null;
 const section=matches[0],next=sections[sections.indexOf(section)+1];
 return lines.slice(section.index,next?.index??lines.length).join('\n').trim();
}

export function summarizeKnowledge(sources:any[]){
 const points=new Map<string,any>();
 for(const source of sources){
  for(const point of knowledgePointsSchema.parse(JSON.parse(source.knowledgePoints||'[]'))){
   const key=point.label.normalize('NFKC').replace(/\s/g,'').toLocaleLowerCase();
   const entry=points.get(key)||{label:point.label,summary:point.summary,signal:point.signal,evidence:[]};
   entry.summary=point.summary;entry.signal=point.signal;
   // Count learning turns, not repeated tool calls or multiple items in one turn.
   if(!entry.evidence.some((e:any)=>e.sourceId===source.sourceId))entry.evidence.push({sourceId:source.sourceId,turnId:source.source.turnId,signal:point.signal,text:point.evidence});
   points.set(key,entry);
  }
 }
 return [...points.values()].map(p=>({...p,rounds:p.evidence.length,repeated:p.evidence.length>1})).sort((a,b)=>b.rounds-a.rounds);
}
