// CI smoke: isolate by SHIZHI_DATA_DIR. No model calls, no real desktop acceptance claim.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {root,dataRoot,baseUrl,learningRoot} from '../server/config.js';
import {machineConfig,appVersion} from '../shared/runtime.mjs';
if(!process.env.SHIZHI_DATA_DIR||resolve(dataRoot).includes('Application Support'))throw new Error('只允许显式隔离数据目录');
const config=JSON.parse(readFileSync(machineConfig,'utf8'));assert.equal(config.env.SHIZHI_DATA_DIR,dataRoot);
const hooks=JSON.parse(readFileSync(join(learningRoot,'.codex','hooks.json'),'utf8'));assert.ok(hooks.hooks.Stop[0].hooks[0].commandWindows);
const toml=readFileSync(join(learningRoot,'.codex','config.toml'),'utf8');assert.ok(toml.includes('[mcp_servers.shizhi.env]'));
let child:ReturnType<typeof spawn>|undefined;
try{
 if(process.platform==='win32'){
  const result=spawnSync(process.execPath,[join(root,'scripts','install-windows-service.mjs')],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
 }else child=spawn(process.execPath,[join(root,'node_modules','tsx','dist','cli.mjs'),join(root,'server','index.ts')],{cwd:root,env:process.env,stdio:'ignore'});
 for(let index=0;index<30;index++){try{const r=await fetch(baseUrl+'/api/v1/health');if(r.ok)break}catch{}await new Promise(resolve=>setTimeout(resolve,250))}
 const health=await(await fetch(baseUrl+'/api/v1/health')).json();assert.equal(health.version,appVersion);
 const dashboard=await(await fetch(baseUrl+'/api/v1/dashboard')).json();assert.equal(dashboard.summary.totalNotes,0);assert.equal(dashboard.summary.activeDays,0);
 const html=await(await fetch(baseUrl+'/')).text();assert.ok(html.includes('assets/'));
 const asset=html.match(/src="([^"]+\.js)"/)![1];assert.equal((await fetch(baseUrl+asset)).status,200);
 const doctor=spawnSync(process.execPath,[join(root,'node_modules','tsx','dist','cli.mjs'),join(root,'scripts','doctor.ts')],{encoding:'utf8'});assert.equal(doctor.status,0,doctor.stdout+doctor.stderr);
 const zip=await(await fetch(baseUrl+'/api/v1/backup')).arrayBuffer();const form=new FormData();form.append('backup',new Blob([zip]),'empty.zip');const restore=await fetch(baseUrl+'/api/v1/restore',{method:'POST',headers:{'x-shizhi-client':'web'},body:form});assert.equal(restore.status,200);assert.equal((await restore.json()).notes,0);
 console.log(JSON.stringify({passed:true,version:appVersion,platform:process.platform,dataRoot,emptyHome:true,webAssets:true,doctor:true,backupRestore:true,windowsStartupAndBackground:process.platform==='win32',desktopAcceptance:false},null,2));
}finally{
 if(child){child.kill();await new Promise<void>(resolve=>child!.once('exit',()=>resolve()))}
 if(process.platform==='win32'){const stopped=spawnSync(process.execPath,[join(root,'scripts','service.mjs'),'stop'],{encoding:'utf8'});assert.equal(stopped.status,0,stopped.stdout+stopped.stderr)}
}
