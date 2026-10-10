import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {appVersion,findCodexCommand,machineConfig} from '../shared/runtime.mjs';
import {root,learningRoot,dataRoot,baseUrl} from '../server/config.js';
import {CodexReader} from '../server/codex.js';
const checks:{name:string;ok:boolean;detail:string}[]=[];
const add=(name:string,ok:boolean,detail:string)=>checks.push({name,ok,detail});
const [major,minor]=process.versions.node.split('.').map(Number);
add('Node.js',major===24&&minor>=12,process.version+'；要求 24.12+，24.x');
add('网页构建',existsSync(join(root,'dist','index.html')),'缺失时运行 npm run build');
add('数据库',existsSync(join(dataRoot,'notebook.db')),dataRoot);
add('本机配置',existsSync(machineConfig),'缺失时运行 npm run setup；不要从另一台电脑复制生成配置');
const hooks=join(learningRoot,'.codex','hooks.json'),mcp=join(learningRoot,'.codex','config.toml');
add('项目 hooks 与 MCP',existsSync(hooks)&&existsSync(mcp),learningRoot);
if(existsSync(hooks)){try{const events=JSON.parse(readFileSync(hooks,'utf8')).hooks;add('归档事件定义',['UserPromptSubmit','Stop','Interrupt','SessionEnd'].every(event=>events[event]?.length>0),'事件定义存在不等于已经人工信任')}catch(e){add('归档事件定义',false,(e as Error).message)}}
try{
 const cli=findCodexCommand();const version=spawnSync(cli.command,[...cli.args,'--version'],{encoding:'utf8',windowsHide:true,timeout:10000});add('Codex CLI',version.status===0,version.status===0?version.stdout.trim():'CLI 无法启动：'+(version.error?.message||version.stderr));
 const reader=new CodexReader();try{await reader.connect();add('官方 app-server 握手',true,'initialize / initialized 成功；没有读取任何会话')}finally{reader.close()}
}catch(e){add('Codex CLI',false,(e as Error).message)}
try{const r=await fetch(baseUrl+'/api/v1/health',{signal:AbortSignal.timeout(2000)});const data=await r.json();add('本机服务',r.ok&&data.ok&&data.version===appVersion,JSON.stringify(data));const dashboard=await fetch(baseUrl+'/api/v1/dashboard');add('统计接口',dashboard.ok,baseUrl+'/api/v1/dashboard')}catch(e){add('本机服务',false,'先 npm start 或 npm run install:service；'+(e as Error).message)}
console.log(JSON.stringify({version:appVersion,platform:process.platform,repository:root,learningRoot,dataRoot,url:baseUrl,checks,manualChecks:['在 learning 项目 /hooks 审核并信任本机生成定义','桌面与 CLI 必须使用同一个本机 Codex 环境；不要混用 Windows native 与 WSL','按 docs/WINDOWS.md 验证真实文字、拖图、粘贴截图、多图、追问和离线复习']},null,2));
if(checks.some(check=>!check.ok))process.exitCode=1;
