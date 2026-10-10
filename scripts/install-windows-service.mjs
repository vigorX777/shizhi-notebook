import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {encodedPowerShell,quotePowerShell,repositoryRoot} from '../shared/runtime.mjs';
if(process.platform!=='win32')throw new Error('此脚本只用于 Windows');
const encoded=encodedPowerShell('& '+quotePowerShell(process.execPath)+' '+quotePowerShell(join(repositoryRoot,'scripts','service.mjs'))+" 'start'\nexit $LASTEXITCODE");
const script=`$folder = [Environment]::GetFolderPath('Startup')
$ws = New-Object -ComObject WScript.Shell
$link = $ws.CreateShortcut((Join-Path $folder 'ShizhiNotebook.lnk'))
$link.TargetPath = Join-Path $env:WINDIR 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
$link.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encoded}'
$link.WorkingDirectory = ${quotePowerShell(repositoryRoot)}
$link.WindowStyle = 7
$link.Description = '拾知本机学习笔记服务'
$link.Save()
Write-Output '已安装当前用户登录启动项：ShizhiNotebook.lnk'`;
const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encodedPowerShell(script)],{stdio:'inherit',windowsHide:true});if(result.status!==0)throw new Error('无法创建登录启动项；可先用 npm run service:start 手动后台启动');
const start=spawnSync(process.execPath,[join(repositoryRoot,'scripts','service.mjs'),'start'],{stdio:'inherit'});if(start.status!==0)process.exit(1);
