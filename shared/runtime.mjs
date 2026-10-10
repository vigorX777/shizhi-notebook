import {existsSync,readFileSync,statSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
export const appVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
export const machineConfig=path.join(repositoryRoot,'learning','.codex','shizhi.json');
export function loadMachineEnvironment(){
 if(!existsSync(machineConfig))return;
 const {env}=JSON.parse(readFileSync(machineConfig,'utf8'));
 for(const key of ['SHIZHI_DATA_DIR','SHIZHI_PORT','CODEX_BIN','CODEX_HOME'])if(process.env[key]===undefined&&typeof env?.[key]==='string')process.env[key]=env[key];
}
export function defaultDataRoot(platform=process.platform,env=process.env,home=homedir()){
 const p=platform==='win32'?path.win32:path.posix;
 if(env.SHIZHI_DATA_DIR)return p.resolve(env.SHIZHI_DATA_DIR);
 if(platform==='win32')return p.join(env.LOCALAPPDATA||p.join(home,'AppData','Local'),'ShizhiNotebook');
 if(platform==='darwin')return p.join(home,'Library','Application Support','ShizhiNotebook');
 return p.join(env.XDG_DATA_HOME||p.join(home,'.local','share'),'ShizhiNotebook');
}
export function sameDirectory(a,b){return path.relative(path.resolve(a),path.resolve(b))===''}
export function insideDirectory(file,root,p=path){const relative=p.relative(root,file);return !!relative&&!p.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+p.sep)}
const isFile=file=>{try{return statSync(file).isFile()}catch{return false}};
export function findCodexCommand({platform=process.platform,env=process.env,fileExists=isFile,node=process.execPath}={}){
 const p=platform==='win32'?path.win32:path.posix;
 const directories=(env.PATH||env.Path||'').split(platform==='win32'?';':':').filter(Boolean).map(dir=>dir.replace(/^"|"$/g,''));
 const candidates=env.CODEX_BIN?[env.CODEX_BIN]:directories.flatMap(dir=>platform==='win32'?[p.join(dir,'codex.exe'),p.join(dir,'node_modules','@openai','codex','bin','codex.js')]:[p.join(dir,'codex')]);
 for(let file of candidates){
  if(platform==='win32'&&/\.(cmd|ps1|bat)$/i.test(file))file=p.join(p.dirname(file),'node_modules','@openai','codex','bin','codex.js');
  if(!fileExists(file))continue;
  return /\.(mjs|cjs|js)$/i.test(file)?{command:node,args:[file],binary:file}:{command:file,args:[],binary:file};
 }
 throw new Error('找不到可启动的 Codex CLI。安装 npm install -g @openai/codex，重开终端后运行 setup；CODEX_BIN 可指定 codex.exe 或 codex.js 的绝对路径。');
}
export function runPrisma(args,options={}){const env={...(options.env||process.env)};if(env.DATABASE_URL?.startsWith('file:'))env.DATABASE_URL=env.DATABASE_URL.replaceAll('\\','/');return spawnSync(process.execPath,[path.join(repositoryRoot,'node_modules','prisma','build','index.js'),...args],{cwd:repositoryRoot,encoding:'utf8',...options,env})}
export const quotePosix=value=>"'"+value.replaceAll("'","'\\''")+"'";
export const quotePowerShell=value=>"'"+value.replaceAll("'","''")+"'";
export const encodedPowerShell=script=>Buffer.from(script,'utf16le').toString('base64');
export function hookCommands(node,script){return {command:quotePosix(node)+' '+quotePosix(script),commandWindows:'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+encodedPowerShell('& '+quotePowerShell(node)+' '+quotePowerShell(script)+'\nexit $LASTEXITCODE')}};
