import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,openSync,closeSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {loadMachineEnvironment,defaultDataRoot,repositoryRoot,encodedPowerShell} from '../shared/runtime.mjs';
loadMachineEnvironment();
const action=process.argv[2]||'status',dataRoot=defaultDataRoot(),port=process.env.SHIZHI_PORT||'47831';
const pidFile=join(dataRoot,'service-pid.json'),entry=join(repositoryRoot,'server','index.ts'),loader=join(repositoryRoot,'node_modules','tsx','dist','cli.mjs');
async function healthy(){try{const r=await fetch('http://127.0.0.1:'+port+'/api/v1/health',{signal:AbortSignal.timeout(1500)});const data=await r.json();return r.ok&&data.ok?data:null}catch{return null}}
function managedProcess(){
 if(!existsSync(pidFile))return null;const saved=JSON.parse(readFileSync(pidFile,'utf8'));
 if(saved.root!==repositoryRoot||!Number.isSafeInteger(saved.pid)||saved.pid<1)throw new Error('后台进程记录属于其他仓库；请先在旧仓库停止服务');
 const command=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encodedPowerShell(`$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${saved.pid}"; if ($p) { [Console]::Write($p.CommandLine) }`)],{encoding:'utf8',windowsHide:true});
 if(command.status!==0)throw new Error('无法核对后台进程，请在任务管理器检查拾知 Node 进程');
 return command.stdout.toLowerCase().includes(entry.toLowerCase())&&command.stdout.toLowerCase().includes(loader.toLowerCase())?saved:null;
}
if(action==='status'){console.log(JSON.stringify({running:!!await healthy(),health:await healthy(),dataRoot,port},null,2));process.exit(0)}
if(!['start','stop'].includes(action))throw new Error('用法：npm run service:start | service:stop | service:status');
if(process.platform==='darwin'){
 const result=spawnSync('launchctl',action==='start'?['kickstart','gui/'+process.getuid()+'/com.shizhi.notebook']:['bootout','gui/'+process.getuid()+'/com.shizhi.notebook'],{stdio:'inherit'});
 if(result.status!==0)throw new Error('服务操作失败；首次启动请运行 npm run install:service');
}else if(process.platform==='win32'){
 if(action==='stop'){
  const saved=managedProcess();if(saved){const result=spawnSync('taskkill.exe',['/PID',String(saved.pid),'/T','/F'],{stdio:'inherit',windowsHide:true});if(result.status!==0)throw new Error('停止后台进程失败')}
  if(existsSync(pidFile))unlinkSync(pidFile);console.log('后台服务已停止。登录启动项仍保留；取消自启动请删除启动文件夹内 ShizhiNotebook.lnk。');
 }else{
  if(await healthy()){console.log('本机服务已运行，无需重复启动。');process.exit(0)}
  if(managedProcess())throw new Error('后台进程仍在启动或异常；查看 service-error.log 后停止再启动');
  if(!existsSync(join(repositoryRoot,'dist','index.html'))||!existsSync(join(dataRoot,'notebook.db')))throw new Error('先执行 npm run setup 和 npm run build');
  mkdirSync(dataRoot,{recursive:true});const out=openSync(join(dataRoot,'service.log'),'a'),err=openSync(join(dataRoot,'service-error.log'),'a');
  const child=spawn(process.execPath,[loader,entry],{cwd:repositoryRoot,env:process.env,detached:true,windowsHide:true,stdio:['ignore',out,err]});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});closeSync(out);closeSync(err);writeFileSync(pidFile,JSON.stringify({pid:child.pid,root:repositoryRoot}),{mode:0o600});child.unref();
  for(let attempt=0;attempt<20;attempt++){if(await healthy()){console.log('后台服务已启动：http://127.0.0.1:'+port);process.exit(0)}await new Promise(resolve=>setTimeout(resolve,250))}
  throw new Error('后台启动未通过健康检查；查看数据目录 service-error.log，使用 service:stop 后重试');
 }
}else throw new Error('自动后台服务只支持 macOS 和 Windows；其他系统使用 npm start。');
