// Prepend globalThis.shizhiHomeAudit={root:<repository>,space:47}. Read-only formal-instance check.
const config=globalThis.shizhiHomeAudit,fs=await import('node:fs/promises');
const task=await taskSpace(config.space),page=task.page('p1'),assert=(value,message)=>{if(!value)throw new Error(message)};
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1368,height:1035,deviceScaleFactor:1,mobile:false});await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
await page.goto('http://127.0.0.1:47831/#');await page.reload();await page.waitForSelector('.home-dashboard');
const {dashboard,notes}=await page.evaluate(async()=>({dashboard:await(await fetch('/api/v1/dashboard')).json(),notes:await(await fetch('/api/v1/notes')).json()}));
assert(dashboard.summary.totalNotes===notes.length&&dashboard.subjects.every(subject=>notes.filter(note=>note.subject===subject.subject).length===subject.total),'正式首页与笔记库存不匹配');
const desktop=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,nav:[...document.querySelectorAll('nav a')].map(a=>a.textContent),panels:[...document.querySelectorAll('.home-panel')].map(el=>{const r=el.getBoundingClientRect();return {heading:el.querySelector('h2')?.textContent,left:r.left,right:r.right,top:r.top}}),months:[...document.querySelectorAll('.month-labels span')].map(el=>el.textContent),titlesRemoved:!document.querySelector('.topbar')&&!document.body.textContent.includes('把问过的问题，变成真正学会的知识。')}));
assert(desktop.width===desktop.scrollWidth&&desktop.titlesRemoved,'正式桌面布局溢出或恢复旧标题');
let keyboardAnimationEscape=false,historyForward=false,thumbnails=0;
if(dashboard.subjects.length){
 const subject=dashboard.subjects[0],selector='button[aria-label="打开'+subject.subject+'笔记本"]';
 await page.focus(selector);await page.press(selector,'Enter');await page.waitForSelector('.book-opening');await page.press('body','Escape');await page.waitForFunction(()=>!document.querySelector('.book-opening'));assert(await page.evaluate(()=>['','#'].includes(location.hash)&&!!document.querySelector('.home-dashboard')),'Escape未取消开书');keyboardAnimationEscape=true;
 await page.click(selector);await page.waitForFunction(total=>document.querySelector('.subject-context')&&document.querySelectorAll('.note-row').length===total,subject.total);
 thumbnails=await page.evaluate(()=>document.querySelectorAll('.note-thumbnail img').length);const expected=notes.filter(note=>note.subject===subject.subject&&note.sources.some(link=>link.source.attachments.some(attachment=>link.attachmentIds.includes(attachment.id)))).length;assert(thumbnails===expected,'正式笔记缩略图缺失');
 await page.evaluate(()=>history.back());await page.waitForSelector('.notebook-cover');await page.evaluate(()=>history.forward());await page.waitForFunction(total=>document.querySelector('.subject-context')&&document.querySelectorAll('.note-row').length===total,subject.total);assert(await page.evaluate(()=>!document.querySelector('.book-opening')),'历史前进播放动画');historyForward=true;
}
await page.goto('http://127.0.0.1:47831/#');await page.waitForSelector('.home-dashboard');await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});const narrow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert(narrow.width===narrow.scrollWidth,'正式首页窄屏溢出');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1368,height:1035,deviceScaleFactor:1,mobile:false});
const result={passed:true,readOnly:true,summary:dashboard.summary,subjects:dashboard.subjects,desktop,narrow,keyboardAnimationEscape,historyForward,thumbnails};await fs.writeFile(config.root+'/.local/home-live-ui-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));console.log((await page.snapshot()).slice(0,1800));
