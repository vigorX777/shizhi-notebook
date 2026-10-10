import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {root,dataRoot,port} from '../server/config.js';
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
import {findCodexCommand} from '../shared/runtime.mjs';
if(process.platform==='win32'){await import('./install-windows-service.mjs');process.exit(0)}
if(process.platform!=='darwin')throw new Error('后台安装仅支持 macOS 与 Windows，其他系统使用 npm start');
const bin=findCodexCommand().binary;
const dir=join(homedir(),'Library','LaunchAgents');mkdirSync(dir,{recursive:true});const path=join(dir,'com.shizhi.notebook.plist');
const args=[process.execPath,join(root,'node_modules/tsx/dist/cli.mjs'),join(root,'server/index.ts')];
writeFileSync(path,`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>com.shizhi.notebook</string><key>ProgramArguments</key><array>${args.map(x=>'<string>'+escape(x)+'</string>').join('')}</array><key>WorkingDirectory</key><string>${escape(root)}</string><key>EnvironmentVariables</key><dict><key>SHIZHI_DATA_DIR</key><string>${escape(dataRoot)}</string><key>SHIZHI_PORT</key><string>${port}</string><key>CODEX_BIN</key><string>${escape(bin)}</string>${process.env.CODEX_HOME?'<key>CODEX_HOME</key><string>'+escape(process.env.CODEX_HOME)+'</string>':''}<key>PATH</key><string>${escape(join(process.execPath,'..'))}:/usr/bin:/bin</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardOutPath</key><string>${escape(join(dataRoot,'service.log'))}</string><key>StandardErrorPath</key><string>${escape(join(dataRoot,'service-error.log'))}</string></dict></plist>`,{mode:0o600});
const domain='gui/'+process.getuid!();spawnSync('launchctl',['bootout',domain,path],{stdio:'ignore'});const result=spawnSync('launchctl',['bootstrap',domain,path],{stdio:'inherit'});if(result.status!==0)throw new Error('LaunchAgent 安装失败');console.log('本机后台服务已安装：'+path);
