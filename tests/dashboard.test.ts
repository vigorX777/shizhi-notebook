import {runPrisma} from '../shared/runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
const dir=mkdtempSync(join(tmpdir(),'shizhi-dashboard-tests-'));process.env.SHIZHI_DATA_DIR=dir;process.env.SHIZHI_PORT='47842';writeFileSync(join(dir,'notebook.db'),'');
const setup=runPrisma(['db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:'file:'+join(dir,'notebook.db')},encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);
const {db}=await import('../server/db.js');
const {aggregateDashboard,beijingDay,getDashboard,recordReview}=await import('../server/dashboard.js');
const {exportBackup,restoreBackup,validateBackup}=await import('../server/backup.js');
const activity=(at:string,kind:'archive'|'review'='review')=>({id:at,kind,at,noteIds:['n'],titles:['题目'],subjects:['数学']});
test('北京时间午夜、跨年、闰年与四周口径',()=>{
 assert.equal(beijingDay(new Date('2026-12-31T15:59:59Z')),'2026-12-31');assert.equal(beijingDay(new Date('2026-12-31T16:00:00Z')),'2027-01-01');
 const records=[activity('2026-12-31T15:59:59Z','archive'),activity('2026-12-31T16:00:00Z'),activity('2026-12-27T16:00:00Z'),activity('2027-01-02T01:00:00Z')];
 const data=aggregateDashboard([{subject:'数学',mastery:'mastered',complete:true},{subject:'数学',mastery:'review',complete:false}],records,'90d',new Date('2026-12-31T16:01:00Z'));
 assert.equal(data.days.length,90);assert.equal(data.days.at(-1)!.date,'2027-01-01');assert.equal(data.days.at(-2)!.archives,1);assert.equal(data.days.at(-1)!.reviews,1);assert.equal(data.summary.activeDays,3);assert.equal(data.summary.weeklyReviews,2);assert.equal(data.weeks.length,4);assert.equal(data.weeks.at(-1)!.start,'2026-12-28');assert.equal(data.subjects[0].incomplete,1);
 const year=aggregateDashboard([],records,'year',new Date('2026-12-31T16:01:00Z'));assert.equal(year.days.length,365);assert.equal(year.days[0].total,1);assert.ok(year.days.slice(1).every(day=>day.total===0));
 assert.equal(aggregateDashboard([],[],'year',new Date('2028-02-29T01:00:00Z')).days.length,366);
});
test('活动事务、同值复习、去重、错误回滚、备份及旧包无历史活动',async()=>{
 try{
  await db.note.createMany({data:[{id:'math',autoTitle:'方程题',autoSubject:'数学',kind:'question',question:'求 x',explanation:'两边同时运算'},{id:'geo',autoTitle:'太阳高度',autoSubject:'地理',kind:'question',question:'高度',explanation:'观察太阳'}]});
  const {app}=await import('../server/index.js');
  try{
   const inject=(method:'POST'|'PATCH',url:string,payload:unknown)=>app.inject({method,url,payload:payload as any,headers:{host:'127.0.0.1:47842','x-shizhi-client':'web'}});
   const get=(url:string)=>app.inject({url,headers:{host:'127.0.0.1:47842'}});
   assert.equal((await get('/api/v1/dashboard?period=bad')).statusCode,400);
   assert.equal((await get('/api/v1/dashboard')).json().summary.activeDays,0);
   await inject('PATCH','/api/v1/notes/math',{mastery:'mastered'});assert.equal(await db.learningActivity.count(),0);
   const sessionId=randomUUID(),url='/api/v1/notes/math/reviews';
   let r=await inject('POST',url,{sessionId,mastery:'mastered'});assert.equal(r.statusCode,200);assert.equal(r.json().recorded,true);assert.equal(r.json().note.mastery,'mastered');
   r=await inject('POST',url,{sessionId,mastery:'review'});assert.equal(r.json().recorded,false);assert.equal(r.json().note.mastery,'review');assert.equal(await db.learningActivity.count(),1);
   assert.equal((await inject('POST','/api/v1/notes/geo/reviews',{sessionId,mastery:'mastered'})).statusCode,400);assert.equal((await db.note.findUniqueOrThrow({where:{id:'geo'}})).mastery,'unmarked');
   assert.equal((await inject('POST',url,{sessionId:randomUUID(),mastery:'unmarked'})).statusCode,400);assert.equal(await db.learningActivity.count(),1);
   assert.equal((await inject('POST','/api/v1/notes/missing/reviews',{sessionId:randomUUID(),mastery:'review'})).statusCode,400);
   await inject('POST',url,{sessionId:randomUUID(),mastery:'review'});assert.equal(await db.learningActivity.count(),2);
   await inject('PATCH','/api/v1/notes/math',{subject:'自定义代数',mastery:'unmarked'});const dashboard=await getDashboard('90d');assert.deepEqual(dashboard.subjects.map(s=>s.subject),['地理','自定义代数']);assert.equal(dashboard.summary.weeklyReviews,2);assert.equal(dashboard.days.at(-1)!.reviews,2);
   const backup=await exportBackup();const expected=await getDashboard('year');await restoreBackup(backup);assert.deepEqual(await getDashboard('year'),expected);
   const files=unzipSync(backup),manifest=JSON.parse(strFromU8(files['manifest.json']));delete manifest.activities;for(const source of manifest.sources)delete source.activityTracked;files['manifest.json']=strToU8(JSON.stringify(manifest));const old=Buffer.from(zipSync(files));assert.deepEqual(validateBackup(old).data.activities,[]);await restoreBackup(old);assert.equal(await db.learningActivity.count(),0);assert.equal((await getDashboard('90d')).summary.totalNotes,2);assert.equal((await getDashboard('90d')).summary.activeDays,0);
   // A malformed activity must fail before either status or inventory is replaced.
   manifest.activities=[{id:'review:'+randomUUID(),ownerId:'local',kind:'review',noteId:'missing',sourceId:null,occurredAt:new Date().toISOString()}];files['manifest.json']=strToU8(JSON.stringify(manifest));await assert.rejects(()=>restoreBackup(Buffer.from(zipSync(files))),/复习活动来源/);assert.equal(await db.note.count(),2);
  }finally{await app.close()}
 }finally{await db.$disconnect()}
});
