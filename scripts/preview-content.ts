import {runPrisma} from '../shared/runtime.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'shizhi-render-preview-'));process.env.SHIZHI_DATA_DIR=dir;process.env.SHIZHI_PORT='47840';writeFileSync(join(dir,'notebook.db'),'');
const setup=runPrisma(['db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:'file:'+join(dir,'notebook.db')},encoding:'utf8'});if(setup.status!==0)throw new Error(setup.stderr);
const {CodexReader}=await import('../server/codex.js'),{learningRoot,root}=await import('../server/config.js');
const answer=readFileSync(join(root,'tests/fixtures/rendering.md'),'utf8');
const turns=[{id:'preview-first',items:[{type:'userMessage',content:[{type:'text',text:'为什么移项变号？'}]},{type:'agentMessage',phase:'final_answer',text:answer}]},{id:'preview-follow',items:[{type:'userMessage',content:[{type:'text',text:'原来是两边同时减 3，我明白了'}]},{type:'agentMessage',phase:'final_answer',text:'你已经说出了这一步的原因：两边同时做**相同运算**。\n\n$$2x+3-3=7-3$$'}]}];
CodexReader.prototype.read=async()=>({id:'render-preview-fixture',cwd:learningRoot,turns});
const {record,closeReader}=await import('../server/archive.js');
const item={itemKey:'equation',title:'数学_等式性质与移项_为什么移项变号',kind:'knowledge',subject:'数学',tags:['等式性质'],question:'为什么移项变号？',explanation:answer,knowledgePoints:[{label:'移项变号',summary:'等式两边同时减去同一个数，等式仍成立。',signal:'discussed',evidence:'为什么移项变号？'}]};
const result=await record({threadId:'render-preview-fixture',turnId:'preview-first',disposition:'learning',items:[item]});const id=result.notes[0].id;
await record({threadId:'render-preview-fixture',turnId:'preview-follow',disposition:'learning',items:[{...item,noteId:id,question:'原来是两边同时减 3，我明白了',knowledgePoints:[{label:'移项变号',summary:'移项是两边同时进行逆运算。理解理由后再使用简写。',signal:'confirmed',evidence:'原来是两边同时减 3，我明白了'}]}]});
let nativeNoteId:string|undefined;
if(process.argv[2]){
 const path=process.argv[2],offline=join(learningRoot,'.preview-native-'+process.pid+'.html');
 const result=spawnSync(process.execPath,[join(root,'learning/scripts/export-visual.mjs'),path,offline],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);
 const nativeAnswer='切换日期，观察太阳高度与方位。\n\nvisualize'+JSON.stringify({path})+'';
 turns.push({id:'preview-native',items:[{type:'userMessage',content:[{type:'text',text:'用图观察正午太阳高度'}]},{type:'agentMessage',phase:'final_answer',text:nativeAnswer}]});
 const saved=await record({threadId:'render-preview-fixture',turnId:'preview-native',disposition:'learning',items:[{...item,itemKey:'solar',title:'原生图解独立归档演示',question:'用图观察正午太阳高度',tags:['太阳高度'],knowledgePoints:[],explanation:nativeAnswer,visualizations:[{path,offlinePath:offline,label:'太阳高度变化'}]}]});
 nativeNoteId=saved.notes[0].id;unlinkSync(offline);
}
closeReader();
mkdirSync(join(root,'.local'),{recursive:true});writeFileSync(join(root,'.local/render-preview.json'),JSON.stringify({url:'http://127.0.0.1:47840/#note/'+id,dataRoot:dir,noteId:id,nativeNoteId,synthetic:true},null,2));
console.log('隔离渲染测试网页：http://127.0.0.1:47840/#note/'+id);await import('../server/index.js');
