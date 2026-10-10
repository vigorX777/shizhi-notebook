import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {defaultDataRoot,findCodexCommand,insideDirectory,hookCommands,encodedPowerShell,quotePowerShell,appVersion,repositoryRoot} from '../shared/runtime.mjs';
process.env.SHIZHI_DATA_DIR=mkdtempSync(path.join(tmpdir(),'shizhi-runtime-test-'));
const {visualReferenceError}=await import('../server/visualizations.js');
// Set an isolated data root before loading server modules through visualizations.
// This file exercises pure platform paths plus a real subprocess, no model requests.
test('各系统目录与 Windows Codex npm 包入口，不执行 .cmd',()=>{
 assert.equal(defaultDataRoot('win32',{LOCALAPPDATA:'C:\\Users\\学生\\AppData\\Local'},'C:\\Users\\学生'),'C:\\Users\\学生\\AppData\\Local\\ShizhiNotebook');
 assert.equal(defaultDataRoot('win32',{},'D:\\同学'),'D:\\同学\\AppData\\Local\\ShizhiNotebook');
 assert.equal(defaultDataRoot('darwin',{},'/Users/student'),'/Users/student/Library/Application Support/ShizhiNotebook');
 assert.equal(defaultDataRoot('linux',{},'/home/student'),'/home/student/.local/share/ShizhiNotebook');
 const file='C:\\Program Files\\npm\\node_modules\\@openai\\codex\\bin\\codex.js';
 const cli=findCodexCommand({platform:'win32',env:{PATH:'C:\\Program Files\\npm'},node:'C:\\Program Files\\nodejs\\node.exe',fileExists:candidate=>candidate===file});
 assert.deepEqual(cli,{command:'C:\\Program Files\\nodejs\\node.exe',args:[file],binary:file});
 assert.deepEqual(findCodexCommand({platform:'win32',env:{CODEX_BIN:'C:\\Program Files\\npm\\codex.cmd'},node:'node.exe',fileExists:candidate=>candidate===file}).args,[file]);
 assert.throws(()=>findCodexCommand({platform:'win32',env:{PATH:''}}),/找不到/);
 assert.equal(insideDirectory('D:\\outside\\diagram.html','C:\\study',path.win32),false);
 assert.equal(insideDirectory('C:\\study-backup\\diagram.html','C:\\study',path.win32),false);
 assert.equal(insideDirectory('C:\\Study\\题目\\diagram.html','c:\\study',path.win32),true);
 assert.match(visualReferenceError('[图](C:\\study\\temporary.html)')!,/尚未独立归档/);
 assert.match(visualReferenceError('[图](file:///C:/study/temporary.html)')!,/尚未独立归档/);
});
test('空格、中文、美元符号及单引号的 hook 命令保持参数和 stdin 原文',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"shizhi 学习 '$ "));
 const script=path.join(dir,"echo '$ 学习.mjs");writeFileSync(script,"import {readFileSync} from 'node:fs';process.stdout.write(readFileSync(0,'utf8'));\n");
 const input=JSON.stringify({prompt:'你好，截图题',cwd:dir}),commands=hookCommands(process.execPath,script);
 const result=process.platform==='win32'?spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',commands.commandWindows.split(' ').at(-1)!],{input,encoding:'utf8'}):spawnSync('/bin/sh',['-c',commands.command],{input,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,input);
 const decoded=Buffer.from(commands.commandWindows.split(' ').at(-1)!,'base64').toString('utf16le');assert.ok(decoded.includes(quotePowerShell(script)));
 assert.equal(Buffer.from(encodedPowerShell('你好'),'base64').toString('utf16le'),'你好');
 assert.equal(appVersion,'1.0.0');assert.ok(repositoryRoot);
});
