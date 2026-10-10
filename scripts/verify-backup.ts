import {runPrisma} from '../shared/runtime.mjs';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const backupPath=process.argv[2];if(!backupPath)throw new Error('请提供备份 ZIP 路径');
const dir=mkdtempSync(join(tmpdir(),'shizhi-backup-verification-'));process.env.SHIZHI_DATA_DIR=dir;writeFileSync(join(dir,'notebook.db'),'');
const setup=runPrisma(['db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:'file:'+join(dir,'notebook.db')},encoding:'utf8'});if(setup.status!==0)throw new Error(setup.stderr);
const {validateBackup,restoreBackup}=await import('../server/backup.js');const {db}=await import('../server/db.js');const {attachmentsRoot}=await import('../server/config.js');
try{const bytes=readFileSync(backupPath),expected=validateBackup(bytes).data;assert.equal(await db.note.count(),0);await restoreBackup(bytes);
for(const [model,rows] of [[db.note,expected.notes],[db.source,expected.sources],[db.attachment,expected.attachments],[db.noteSource,expected.links],[db.learningActivity,expected.activities]] as const){const actual=JSON.parse(JSON.stringify(await (model as any).findMany()));const sort=(data:any[])=>data.map(x=>JSON.stringify(x)).sort();assert.deepEqual(sort(actual),sort(JSON.parse(JSON.stringify(rows))))}
for(const a of expected.attachments)assert.equal(createHash('sha256').update(readFileSync(join(attachmentsRoot,a.filename))).digest('hex'),a.sha256);
console.log(JSON.stringify({passed:true,isolatedDataRoot:dir,notes:expected.notes.length,sources:expected.sources.length,attachments:expected.attachments.length,activities:expected.activities.length},null,2));
}finally{await db.$disconnect()}
