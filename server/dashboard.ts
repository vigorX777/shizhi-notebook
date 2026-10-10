import {z} from 'zod';
import {db,noteInclude,presentNote} from './db.js';
import type {ActivityItem,DashboardData,SubjectSummary} from '../shared/dashboard.js';
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
export function beijingDay(date:Date){const parts=formatter.formatToParts(date);const value=(kind:string)=>parts.find(part=>part.type===kind)!.value;return `${value('year')}-${value('month')}-${value('day')}`}
export function shiftDay(day:string,offset:number){const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)}
export function monday(day:string){return shiftDay(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7))}
const standardSubjects=['语文','数学','英语','物理','化学','生物','道德与法治','历史','地理'];
export function orderSubjects(a:string,b:string){const rank=(subject:string)=>subject==='待分类'?100:standardSubjects.includes(subject)?standardSubjects.indexOf(subject):50;return rank(a)-rank(b)||a.localeCompare(b,'zh-CN')}
export function aggregateDashboard(notes:{subject:string;mastery:string;complete:boolean}[],activities:ActivityItem[],period:'90d'|'year',now=new Date()):DashboardData{
 const today=beijingDay(now),start=period==='90d'?shiftDay(today,-89):today.slice(0,4)+'-01-01',end=period==='90d'?today:today.slice(0,4)+'-12-31';
 const subjects=new Map<string,SubjectSummary>();
 for(const note of notes){const subject=subjects.get(note.subject)||{subject:note.subject,total:0,mastered:0,review:0,unmarked:0,incomplete:0};subject.total++;if(note.mastery==='mastered')subject.mastered++;else if(note.mastery==='review')subject.review++;else subject.unmarked++;if(!note.complete)subject.incomplete++;subjects.set(note.subject,subject)}
 const byDay=new Map<string,ActivityItem[]>();for(const activity of activities){const day=beijingDay(new Date(activity.at));if(day>today)continue;const items=byDay.get(day)||[];items.push(activity);byDay.set(day,items)}
 const days=[];for(let date=start;date<=end;date=shiftDay(date,1)){const items=byDay.get(date)||[];const archives=items.filter(item=>item.kind==='archive').length,reviews=items.length-archives;days.push({date,archives,reviews,total:items.length,items})}
 const thisMonday=monday(today),weeks=[];for(let index=3;index>=0;index--){const weekStart=shiftDay(thisMonday,-index*7),weekEnd=shiftDay(weekStart,6);const reviews=activities.filter(activity=>activity.kind==='review'&&beijingDay(new Date(activity.at))>=weekStart&&beijingDay(new Date(activity.at))<=weekEnd&&beijingDay(new Date(activity.at))<=today).length;weeks.push({start:weekStart,end:weekEnd,reviews})}
 return {period,today,subjects:[...subjects.values()].sort((a,b)=>orderSubjects(a.subject,b.subject)),summary:{totalNotes:notes.length,mastered:notes.filter(note=>note.mastery==='mastered').length,activeDays:byDay.size,weeklyReviews:weeks.at(-1)!.reviews},days,weeks};
}
export async function getDashboard(period:'90d'|'year'){
 const result=await db.$transaction(async tx=>({notes:await tx.note.findMany({where:{ownerId:'local'},select:{autoSubject:true,manualSubject:true,mastery:true,sources:{select:{source:{select:{status:true}}}}}}),activities:await tx.learningActivity.findMany({where:{ownerId:'local'},orderBy:{occurredAt:'asc'},select:{id:true,kind:true,occurredAt:true,note:{select:{id:true,autoTitle:true,manualTitle:true,autoSubject:true,manualSubject:true}},source:{select:{links:{select:{note:{select:{id:true,autoTitle:true,manualTitle:true,autoSubject:true,manualSubject:true}}}}}}}})}));
 const activities=result.activities.map(activity=>{const notes=activity.note?[activity.note]:activity.source?.links.map(link=>link.note)||[];return {id:activity.id,kind:activity.kind as 'archive'|'review',at:activity.occurredAt.toISOString(),noteIds:[...new Set(notes.map(note=>note.id))],titles:[...new Map(notes.map(note=>[note.id,note.manualTitle??note.autoTitle])).values()],subjects:[...new Set(notes.map(note=>note.manualSubject??note.autoSubject))]}});
 return aggregateDashboard(result.notes.map(note=>({subject:note.manualSubject??note.autoSubject,mastery:note.mastery,complete:note.sources.every(link=>link.source.status==='complete')})),activities,period);
}
export const reviewSchema=z.object({sessionId:z.string().uuid(),mastery:z.enum(['review','mastered'])}).strict();
export async function recordReview(noteId:string,input:unknown){
 const data=reviewSchema.parse(input),id='review:'+data.sessionId;
 return db.$transaction(async tx=>{
  const note=await tx.note.findUnique({where:{id:noteId}});if(!note||note.ownerId!=='local')throw new Error('笔记不存在');
  const existing=await tx.learningActivity.findUnique({where:{id}});if(existing&&(existing.kind!=='review'||existing.noteId!==noteId))throw new Error('复习会话已经用于另一条笔记');
  const updated=await tx.note.update({where:{id:noteId},data:{mastery:data.mastery},include:noteInclude});
  if(!existing)await tx.learningActivity.create({data:{id,kind:'review',noteId}});
  return {note:presentNote(updated),recorded:!existing};
 });
}
