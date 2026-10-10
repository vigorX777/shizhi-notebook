import {runPrisma} from '../shared/runtime.mjs';
// Isolated fixtures only. Never writes to the user's learning database.
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const empty=process.argv.includes('--empty'),covers=process.argv.includes('--covers');const dir=mkdtempSync(join(tmpdir(),'shizhi-home-preview-'));process.env.SHIZHI_DATA_DIR=dir;process.env.SHIZHI_PORT=empty?'47843':covers?'47844':'47841';writeFileSync(join(dir,'notebook.db'),'');
const setup=runPrisma(['db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:'file:'+join(dir,'notebook.db')},encoding:'utf8'});if(setup.status!==0)throw new Error(setup.stderr);
const {db}=await import('../server/db.js');const {root,learningRoot}=await import('../server/config.js');
const ids:string[]=[];
if(!empty){
 const {CodexReader}=await import('../server/codex.js');const {record,collect,sourceId}=await import('../server/archive.js');const turns:any[]=[];
 CodexReader.prototype.read=async()=>({id:'home-preview-fixture',cwd:learningRoot,turns});
 const subjects=covers?['数学','语文','英语','物理','化学','生物','地理','历史','道德与法治','待分类','自定义科目']:['数学','数学','数学','地理'];
 for(const [index,subject] of subjects.entries()){
  const turnId='preview-'+index;turns.push({id:turnId,items:[{type:'userMessage',content:[{type:'text',text:subject==='数学'?'求方程 $2x+3=7$ 的解。':'夏至日的太阳直射哪个纬线？'},{type:'localImage',path:join(root,'tests/fixtures/math-single.png')}]},{type:'agentMessage',phase:'final_answer',text:'先读条件，再应用**已知知识点**。\n\n$$2x+3-3=7-3$$\n\n结论取决于题目条件。'}]});
  const raw=await collect('home-preview-fixture',turnId);const picture=await db.attachment.findFirstOrThrow({where:{sourceId:raw.id}});
  const result=await record({threadId:'home-preview-fixture',turnId,disposition:'learning',items:[{itemKey:'q',title:subject+' · 首页验收题 '+(index+1),subject,kind:'question',tags:['条件分析'],question:raw.question,explanation:'先读条件，再应用**已知知识点**。\n\n$$2x+3-3-3=7-3$$',attachmentIds:[picture.id]}]});
  const id=result.notes[0].id;ids.push(id);await db.note.update({where:{id},data:{mastery:index===0?'mastered':index===1?'review':'unmarked',wrong:index===1}});
  await db.learningActivity.update({where:{id:'archive:'+sourceId('home-preview-fixture',turnId)},data:{occurredAt:new Date(Date.now()-index*7*86400000)}});
 }
 for(let i=0;i<3;i++)await db.learningActivity.create({data:{id:'review:'+randomUUID(),kind:'review',noteId:ids[0],occurredAt:new Date(Date.now()-(i*7+1)*86400000)}});
}
const metadata={url:'http://127.0.0.1:'+process.env.SHIZHI_PORT,synthetic:true,dataRoot:dir,noteIds:ids};mkdirSync(join(root,'.local'),{recursive:true});writeFileSync(join(root,'.local/home-preview'+(empty?'-empty':covers?'-covers':'')+'.json'),JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata));await import('../server/index.js');
