// Egolite entry point. Prepend globalThis.shizhiVisualAudit={root:<absolute path>,space:47}.
const fs=await import('node:fs/promises');
const config=globalThis.shizhiVisualAudit;if(!config?.root)throw new Error('需要当前仓库与用户授权的 Egolite 空间');
const task=await taskSpace(config.space),page=task.page('p1');const check=(condition,message)=>{if(!condition)throw new Error(message)};
const snapshot=async()=>String(await page.snapshot({scope:'full_page'}));
const report={checkedAt:new Date().toISOString(),synthetic:false,sourceTurn:'01a12416-5756-7312-8c25-07756e328e4f',checks:{}};
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
await page.goto('http://127.0.0.1:47831/#note/10f14e93-531d-4f12-aee4-a91c9131389e');await page.waitForSelector('[data-season]');
await page.selectOption('[data-season]','23.5');check((await snapshot()).includes('太阳高度 76.5° · 天顶北侧'),'夏至计算或方向错误');
await page.selectOption('[data-time]','16.6666667');check((await snapshot()).includes('太阳西北，影子东南'),'下午影子方向错误');
await page.selectOption('[data-time]','12');await page.selectOption('[data-season]','0');check((await snapshot()).includes('太阳高度 80.0° · 天顶南侧'),'春分高度错误');
await page.focus('input[data-delta]');await page.press('input[data-delta]','ArrowRight');const delta=await snapshot();check(delta.includes('自选直射纬度')&&delta.includes('= 80°'),'直射纬度或同高度两地未更新');
const solarDoc=await page.evaluate(()=>document.querySelector('iframe').srcdoc);await fs.writeFile(config.root+'/.local/archive-solar-audit.html',solarDoc);
report.checks.solarNotebook={summer:'76.5° 天顶北侧',equinox:'80.0° 天顶南侧',afternoon:'太阳西北，影子东南',deltaChangesPair:true};
await page.goto('http://127.0.0.1:47831/#note/963552c9-4406-46f1-b96e-dbace938a811');await page.waitForSelector('[data-step]');
await page.selectOption('[data-step]','1');check((await snapshot()).includes('AD 与 BC 成90°'),'辅助线步骤不正确');
await page.selectOption('[data-step]','2');check((await snapshot()).includes('∠ADE = 45°'),'射影步骤不正确');
await page.selectOption('[data-step]','3');check((await snapshot()).includes('cos θ = 1/√5'),'法向量步骤不正确');
const refreshBaseline=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/api/v1/notes')).length);
await page.waitForFunction(baseline=>performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/api/v1/notes')).length>baseline,refreshBaseline,{timeout:15000});check((await snapshot()).includes('cos θ = 1/√5'),'刷新重置图解');
const geometryDoc=await page.evaluate(()=>document.querySelector('iframe').srcdoc);await fs.writeFile(config.root+'/.local/archive-geometry-audit.html',geometryDoc);
await page.click("loc=role:button[name='进入复习 · 隐藏讲解']");const hidden=await page.evaluate(()=>({frames:document.querySelectorAll('iframe').length,formulas:document.querySelectorAll('.katex').length,knowledge:document.querySelectorAll('.knowledge-summary').length,originals:document.querySelectorAll('.originals img').length}));check(hidden.frames===0&&hidden.formulas===0&&hidden.knowledge===0&&hidden.originals===1,'复习隐藏未完全生效');report.checks.hidden=hidden;
await page.click("loc=role:button[name='查看讲解']");await page.waitForSelector('[data-step]');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});report.checks.narrowNotebook=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,iframeWidth:document.querySelector('iframe').getBoundingClientRect().width}));check(report.checks.narrowNotebook.width===report.checks.narrowNotebook.scrollWidth,'窄屏网页溢出');
// A sandboxed iframe is an OOPIF in Egolite. Audit its exact stored srcdoc as a
// standalone document, without weakening the notebook sandbox or rereading originals.
await page.goto('http://127.0.0.1:47843/archive-geometry-audit.html');await page.waitForSelector('[data-step]');
await page.selectOption('[data-step]','2');const initial=await page.evaluate(()=>({status:document.querySelector('[data-status]').textContent,paths:[...document.querySelectorAll('.scene path')].map(n=>n.getAttribute('d'))}));
await page.focus('input[data-yaw]');await page.press('input[data-yaw]','ArrowRight');const rotated=await page.evaluate(()=>({status:document.querySelector('[data-status]').textContent,paths:[...document.querySelectorAll('.scene path')].map(n=>n.getAttribute('d'))}));check(initial.status===rotated.status&&JSON.stringify(initial.paths)!==JSON.stringify(rotated.paths),'旋转未更新或改变真实关系');
report.checks.geometryStoredDocument={rotationChangesProjectionOnly:true};
for(const width of [294,390,736]){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
 report.checks.geometryStoredDocument[width]=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('svg text')].filter(n=>{const b=n.ownerSVGElement.getBoundingClientRect(),r=n.getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1}).map(n=>n.textContent)}));
}
await page.goto('http://127.0.0.1:47843/archive-solar-audit.html');await page.waitForSelector('[data-season]');await page.selectOption('[data-season]','23.5');
const before=await page.evaluate(()=>({status:document.querySelector('[data-status]').textContent,paths:[...document.querySelectorAll('.scene path')].map(n=>n.getAttribute('d'))}));await page.focus('input[data-yaw]');await page.press('input[data-yaw]','ArrowRight');const after=await page.evaluate(()=>({status:document.querySelector('[data-status]').textContent,paths:[...document.querySelectorAll('.scene path')].map(n=>n.getAttribute('d'))}));check(before.status===after.status&&JSON.stringify(before.paths)!==JSON.stringify(after.paths),'地理旋转未更新或改变高度');report.checks.solarStoredDocument={rotationChangesProjectionOnly:true};
for(const width of [294,390,736]){await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});report.checks.solarStoredDocument[width]=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('svg text')].filter(n=>{const b=n.ownerSVGElement.getBoundingClientRect(),r=n.getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1}).map(n=>n.textContent)}))}
report.interactionsPassed=true;report.visualScreenshotAcceptance=false;
await fs.writeFile(config.root+'/.local/real-followup-visuals-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await page.goto('http://127.0.0.1:47831/#note/10f14e93-531d-4f12-aee4-a91c9131389e');
