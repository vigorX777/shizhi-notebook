import {runPrisma} from '../shared/runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {normalizeMath,visualDocument} from '../web/content-format.js';
import {answerSection} from '../server/learning-content.js';
const dir=mkdtempSync(join(tmpdir(),'shizhi-content-'));process.env.SHIZHI_DATA_DIR=dir;
writeFileSync(join(dir,'notebook.db'),'');
assert.equal(runPrisma(['db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:'file:'+join(dir,'notebook.db')},encoding:'utf8'}).status,0);
const {db}=await import('../server/db.js');const {CodexReader}=await import('../server/codex.js');
const {learningRoot}=await import('../server/config.js');
const {record,collect,closeReader}=await import('../server/archive.js');
const {visualReferenceError,embedVisualizations}=await import('../server/visualizations.js');
const {exportBackup,restoreBackup,validateBackup}=await import('../server/backup.js');
const turns:any[]=[];CodexReader.prototype.read=async()=>({id:'content-fixture',cwd:learningRoot,turns});
function turn(id:string,question:string,answer?:string){turns.push({id,items:[{type:'userMessage',content:[{type:'text',text:question}]},...(answer?[{type:'agentMessage',phase:'final_answer',text:answer}]:[])]})}
function input(turnId:string,extra:any={}){return {threadId:'content-fixture',turnId,disposition:'learning',items:[{itemKey:'equation',title:'数学_移项原理_为什么移项变号',kind:'knowledge',subject:'数学',tags:['等式性质'],question:'为什么移项变号',explanation:'待展示的完整讲解',knowledgePoints:[{label:'移项变号',summary:'两边进行同一运算，保持相等。',signal:'discussed',evidence:'为什么移项变号？'}],...extra}]}}
test('最终回答同步、追问增量、知识证据与图解完整备份',async()=>{
 const artifact=join(learningRoot,'.test-visual-'+process.pid+'.html');
 const offline=join(learningRoot,'.test-visual-'+process.pid+'.offline.html');
 try{
  const final='## 为什么移项变号\n\n因为等式两边同时减去 $3$。\n\n\\[2x+3-3=7-3\\]\n\n|步骤|原因|\n|---|---|\n|减去 3|等式性质|';
  turn('first','为什么移项变号？');let result=await record(input('first'));const id=result.notes[0].id;assert.equal(result.source.status,'incomplete');
  turns[0].items.push({type:'agentMessage',phase:'final_answer',text:final});await collect('content-fixture','first');
  await db.note.update({where:{id},data:{manualTitle:'我的等式笔记',reflection:'要保持两边相等',mastery:'review'}});
  assert.equal((await db.note.findUniqueOrThrow({where:{id}})).explanation,final);
  const question='原来两边都减 3，明白了';const followup='对，你解释的是**等式的性质**。';turn('follow',question,followup);
  const follow=input('follow',{noteId:id,title:'不应替换原题',question,explanation:followup,tags:['移项'],knowledgePoints:[{label:'移项变号',summary:'移项是两边同时做逆运算；不是凭空换符号。',signal:'confirmed',evidence:question}]});
  await assert.rejects(()=>record(input('follow',{noteId:id,knowledgePoints:[{label:'移项变号',summary:'已掌握',signal:'confirmed',evidence:'老师认为学生已掌握'}]})),/真实表达/);
  await record(follow);result=await record(follow);
  assert.equal(result.notes[0].question,'为什么移项变号');assert.equal(result.notes[0].explanation,final);assert.equal(result.notes[0].autoTitle,'数学_移项原理_为什么移项变号');assert.equal(result.notes[0].title,'我的等式笔记');assert.equal(result.notes[0].mastery,'review');assert.equal(result.notes[0].sources.length,2);
  assert.equal(result.notes[0].knowledgePoints[0].rounds,2);assert.equal(result.notes[0].knowledgePoints[0].signal,'confirmed');assert.equal(result.notes[0].knowledgePoints[0].evidence[1].text,question);
  const multiAnswer='## 方程题\n\n### 方法\n\n$x=2$\n\n## 英语题\n\n**went** 是 go 的过去式。';turn('multi','两道题',multiAnswer);
  const items=[{...input('multi').items[0],itemKey:'math',answerHeading:'方程题'},{...input('multi').items[0],itemKey:'english',title:'英语题',subject:'英语',answerHeading:'英语题'}];
  const multi=await record({threadId:'content-fixture',turnId:'multi',disposition:'learning',items});assert.equal(multi.source.status,'complete');
  assert.equal(multi.notes.find(n=>n.subject==='数学')!.explanation,'## 方程题\n\n### 方法\n\n$x=2$');assert.equal(multi.notes.find(n=>n.subject==='英语')!.explanation,'## 英语题\n\n**went** 是 go 的过去式。');
  turns.at(-1).items[1].text='## 方程题\n\n只有这一题';assert.equal((await collect('content-fixture','multi')).status,'incomplete');
  await assert.rejects(()=>record({...input('multi'),items:[items[0],{...items[1],answerHeading:'方程题'}]}),/不得重复/);
  writeFileSync(artifact,'<label>系数 <input id="a" type="range" min="1" max="4" value="2"></label><output id="out">2</output><script>a.oninput=()=>out.textContent=a.value</script>');
  const answer=`看这张交互图：[打开图解](${artifact})`;turn('visual','画图解释',answer);
  const visual=await record(input('visual',{visualizations:[{path:artifact,label:'系数变化'}]}));unlinkSync(artifact);
  assert.match(visual.notes[0].explanation,/```learning-html/);assert.ok(!visual.notes[0].explanation.includes(artifact));
  assert.equal((await collect('content-fixture','visual')).status,'complete');
  // Native response references map to the exported copy of exactly the same
  // fragment, while the raw answer still retains its official content reference.
  writeFileSync(artifact,'<style>.lucide{width:16px}</style><div id="native-test"><label class="form-label">观察数值<input class="form-range" type="range" id="native-value" min="1" max="4" value="2"></label><output id="native-output">2</output></div><script>document.getElementById("native-value").oninput=e=>document.getElementById("native-output").textContent=e.target.value;</script>');
  const exported=spawnSync(process.execPath,['learning/scripts/export-visual.mjs',artifact,offline],{encoding:'utf8'});assert.equal(exported.status,0,exported.stderr);
  const nativeAnswer='用滑块观察变化。\n\nvisualize'+JSON.stringify({path:artifact,title:'观察数值'})+'';
  turn('native','用滑块观察变化',nativeAnswer);
  const unheld=await record(input('native'));assert.equal(unheld.source.status,'incomplete');assert.match(unheld.source.error!,/聊天交互图解/);
  const native=await record(input('native',{visualizations:[{path:artifact,offlinePath:offline,label:'观察数值'}]}));
  assert.equal(native.source.status,'complete');assert.equal(native.source.answer,nativeAnswer);assert.match(native.notes[0].explanation,/--viz-series-1/);assert.match(native.notes[0].explanation,/native-value/);assert.ok(!native.notes[0].explanation.includes('visualize'));
  unlinkSync(artifact);unlinkSync(offline);assert.equal((await collect('content-fixture','native')).status,'complete');
  writeFileSync(artifact,'<div id="bad-native"></div><script>lucide.createIcons()</script>');
  assert.notEqual(spawnSync(process.execPath,['learning/scripts/export-visual.mjs',artifact,offline],{encoding:'utf8'}).status,0);unlinkSync(artifact);
  const bytes=await exportBackup(),before=await db.noteSource.findMany({orderBy:{sourceId:'asc'}});await restoreBackup(bytes);assert.deepEqual(await db.noteSource.findMany({orderBy:{sourceId:'asc'}}),before);
  // v1 backups made before this change import with explicit legacy defaults.
  const files=unzipSync(bytes),manifest=JSON.parse(strFromU8(files['manifest.json']));for(const link of manifest.links){delete link.captureMode;delete link.answerHeading;delete link.knowledgePoints;delete link.visuals}files['manifest.json']=strToU8(JSON.stringify(manifest));const legacy=validateBackup(Buffer.from(zipSync(files)));assert.equal(legacy.data.links[0].captureMode,'snapshot');assert.equal(legacy.data.links[0].knowledgePoints,'[]');
  turn('external','图片讲解','![临时图](https://example.com/image.png)');assert.equal((await record(input('external'))).source.status,'incomplete');
 }finally{for(const path of [artifact,offline])try{unlinkSync(path)}catch{}closeReader();await db.$disconnect()}
});
test('数学分隔符转换保护代码，图解不依赖网络',()=>{
 const text='行内 \\(x^2\\)，块级 \\[\\frac{1}{2}\\]\n\n```js\nconst s="\\(x\\)";\n```\n\n`\\[x\\]`';
 const normalized=normalizeMath(text);assert.match(normalized,/\$x\^2\$/);assert.ok(normalized.includes('$$\n\\frac{1}{2}\n$$'));assert.ok(normalized.includes('const s="\\(x\\)";'));assert.ok(normalized.includes('`\\[x\\]`'));
 assert.equal(answerSection('## A\n```md\n## B\n```\ntext\n## B\nreal','A'),'## A\n```md\n## B\n```\ntext');assert.equal(answerSection('## A\ntext','missing'),null);
 assert.equal(answerSection('## A\nfirst\n## A\nsecond','A'),null);
 assert.equal(visualReferenceError('```js\nconst s="![图](https://example.com/x.png)";\n```'),null);
 assert.match(visualReferenceError('![图](attachment:missing)',new Set())!,/原图不存在/);
 assert.ok(embedVisualizations('[图](</tmp/a b.svg>)',[{reference:'/tmp/a b.svg',markdown:'完整图解'}]).includes('完整图解'));
 assert.match(visualReferenceError('```learning-html\n<script src="./library.js"></script>\n```')!,/外部文件/);
 assert.ok(visualDocument('<button>演示</button>').includes("connect-src 'none'"));
});
