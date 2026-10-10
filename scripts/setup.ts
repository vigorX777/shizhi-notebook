import {runPrisma,findCodexCommand,hookCommands,machineConfig} from '../shared/runtime.mjs';
import {writeFileSync,existsSync,readFileSync,unlinkSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {PrismaClient} from '@prisma/client';
import {root,learningRoot,dataRoot,baseUrl} from '../server/config.js';
const dbPath=join(dataRoot,'notebook.db');
if(!existsSync(dbPath))writeFileSync(dbPath,'',{mode:0o600,flag:'wx'});
const before=new PrismaClient();const columns=await before.$queryRawUnsafe<{name:string}[]>('PRAGMA table_info(Source)');await before.$disconnect();const legacy=columns.length>0&&!columns.some(column=>column.name==='activityTracked');
// Retain the pre-upgrade IDs if setup stops between schema push and marking legacy rows.
const marker=join(dataRoot,'activity-upgrade.json');if(legacy&&!existsSync(marker)){const client=new PrismaClient();const rows=await client.$queryRawUnsafe<{id:string}[]>("SELECT id FROM Source WHERE status = 'complete'");await client.$disconnect();writeFileSync(marker,JSON.stringify(rows.map(row=>row.id)),{mode:0o600})}
const result=runPrisma(['db','push'],{env:process.env,stdio:'inherit'});if(result.status!==0)process.exit(1);
if(existsSync(marker)){const ids=JSON.parse(readFileSync(marker,'utf8')) as string[];const upgraded=new PrismaClient();try{await upgraded.$transaction(async tx=>{for(const id of ids)await tx.$executeRawUnsafe('UPDATE Source SET activityTracked = 1 WHERE id = ?',id)});unlinkSync(marker)}finally{await upgraded.$disconnect()}}
const node=process.execPath;const cli=findCodexCommand();const env={SHIZHI_DATA_DIR:dataRoot,SHIZHI_PORT:new URL(baseUrl).port,CODEX_BIN:cli.binary,...(process.env.CODEX_HOME?{CODEX_HOME:process.env.CODEX_HOME}:{})};
mkdirSync(join(learningRoot,'.codex'),{recursive:true});
writeFileSync(machineConfig,JSON.stringify({env},null,2),{mode:0o600});
writeFileSync(join(learningRoot,'.codex','config.toml'),`[mcp_servers.shizhi]\ncommand = ${JSON.stringify(node)}\nargs = [${JSON.stringify(join(root,'node_modules/tsx/dist/cli.mjs'))}, ${JSON.stringify(join(root,'server/mcp.ts'))}]\n\n[mcp_servers.shizhi.env]\n${Object.entries(env).map(([key,value])=>key+' = '+JSON.stringify(value)).join('\n')}\n`);
const commands=hookCommands(node,join(root,'scripts/hook.mjs'));
writeFileSync(join(learningRoot,'.codex','hooks.json'),JSON.stringify({description:'仅用于拾知专用学习目录的自动归档',hooks:Object.fromEntries(['UserPromptSubmit','Stop','Interrupt','SessionEnd'].map(event=>[event,[{hooks:[{type:'command',...commands,timeout:['Interrupt','SessionEnd'].includes(event)?3:30,statusMessage:'保存学习笔记原始内容'}]}]]))},null,2));
console.log(`设置完成。学习目录：${learningRoot}\n数据目录：${dataRoot}\n网页：${baseUrl}\n请在 Codex 添加 learning 为专用项目，审核并信任该项目 hooks；不要把开发仓库作为学习项目。`);
