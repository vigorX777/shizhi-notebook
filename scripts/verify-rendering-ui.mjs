// Run with Egolite, not plain node. Reuses a user-approved task space.
// Prepend globalThis.shizhiRenderTest={root:<absolute repository>,space:47}; see docs/TEACHING-UPDATE.md.
const fs=await import('node:fs/promises');
const config=globalThis.shizhiRenderTest;const root=config?.root;if(!root)throw new Error('请提供 shizhiRenderTest.root 为仓库目录');
const info=JSON.parse(await fs.readFile(root+'/.local/render-preview.json','utf8'));
if(new URL(info.url).port!=='47840'||!info.synthetic)throw new Error('只允许使用独立渲染测试实例');
const task=await taskSpace(Number(config.space));const page=task.page('p1');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
await page.goto(info.url);await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.diagram-image img').length===2&&[...document.querySelectorAll('.diagram-image img')].every(i=>i.complete&&i.naturalWidth>0));
const desktop=await page.evaluate(()=>({formulas:document.querySelectorAll('.katex').length,mathErrors:document.querySelectorAll('.katex-error').length,tables:document.querySelectorAll('.markdown table').length,diagrams:document.querySelectorAll('.diagram-image img').length,iframes:document.querySelectorAll('iframe').length,knowledge:document.querySelector('.knowledge-summary')?.textContent,code:document.querySelector('pre code.language-js')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
assert(desktop.formulas===8&&desktop.mathErrors===0&&desktop.tables===1&&desktop.diagrams===2&&desktop.iframes===1&&!desktop.overflow,'桌面公式／图解渲染不一致');assert(desktop.knowledge.includes('反复讨论 2 轮')&&desktop.knowledge.includes('已明确确认'),'知识摘要或沟通依据缺失');const fixture=await fs.readFile(root+'/tests/fixtures/rendering.md','utf8');const expectedCode=fixture.match(/```js\n([\s\S]*?)\n```/)[1];assert(desktop.code.trim()===expectedCode.trim(),'代码中的数学符号被改写');
await page.waitForSelector('loc=css:input[aria-label="每边的值"]');await page.focus('loc=css:input[aria-label="每边的值"]');await page.press('loc=css:input[aria-label="每边的值"]','ArrowRight');
const interactive=String(await page.snapshot({scope:'full_page'}));assert(interactive.includes('3 = 3'),'交互滑块未生效');
const refreshBaseline=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/api/v1/notes')).length);
await page.waitForFunction(baseline=>performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/api/v1/notes')).length>baseline,refreshBaseline,{timeout:15000});const refreshed=String(await page.snapshot({scope:'full_page'}));assert(refreshed.includes('3 = 3'),'刷新重置了交互图解');
await page.click("loc=role:button[name='进入复习 · 隐藏讲解']");
const hidden=await page.evaluate(()=>({formulas:document.querySelectorAll('.katex').length,visuals:document.querySelectorAll('.diagram,.interactive-visual').length,knowledge:document.querySelectorAll('.knowledge-summary').length,question:document.querySelector('.reading>.markdown')?.textContent}));assert(hidden.formulas===0&&hidden.visuals===0&&hidden.knowledge===0&&hidden.question==='为什么移项变号？','复习隐藏泄露了答案');
await page.click("loc=role:button[name='查看讲解']");await page.waitForSelector('loc=css:.diagram-image img');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
const narrow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,readingWidth:document.querySelector('.reading').getBoundingClientRect().width,diagramWidths:[...document.querySelectorAll('.diagram-image img')].map(e=>e.getBoundingClientRect().width),iframeWidth:document.querySelector('iframe').getBoundingClientRect().width}));assert(narrow.scrollWidth===390,'窄屏页面有横向溢出');
await page.goto('http://127.0.0.1:47840/#library');await page.waitForSelector('loc=css:.search input');await page.fill('loc=css:.search input','不存在的关键词');await page.waitForFunction(()=>document.querySelector('.empty')?.textContent.includes('没有符合条件'));
await page.fill('loc=css:.search input','逆运算');await page.waitForFunction(()=>document.querySelectorAll('.note-row').length===1);const search=await page.evaluate(()=>document.querySelector('.note-row')?.getAttribute('href'));assert(search==='#note/'+info.noteId,'知识点摘要不能被搜索');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
await page.goto('http://127.0.0.1:47831/#note/93803618-7a80-4383-88ca-7dd85867b9dc');await page.waitForFunction(()=>document.querySelectorAll('.katex').length>0&&[...document.querySelectorAll('.originals img')].every(i=>i.complete&&i.naturalWidth>0));
const real=await page.evaluate(async()=>{const n=await(await fetch('/api/v1/notes/93803618-7a80-4383-88ca-7dd85867b9dc')).json();return {noteId:n.id,formulas:document.querySelectorAll('.katex').length,mathErrors:document.querySelectorAll('.katex-error').length,originals:document.querySelectorAll('.originals img').length,exactFinalAnswer:n.explanation===n.sources[0].source.answer,complete:n.complete}});
assert(real.complete&&real.exactFinalAnswer&&real.mathErrors===0&&real.originals===1,'正式笔记最终原文或图片未完整显示');
const report={passed:true,taskSpaceId:task.spaceId,syntheticPreview:info,desktop,interactive:true,hidden,narrow,knowledgeSearch:true,real,screenshot:'Page.captureScreenshot timeout; no visual acceptance claim'};
await fs.writeFile(root+'/.local/rendering-ui-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log(await page.snapshot());
