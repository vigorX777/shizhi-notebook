import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const source=process.argv[2],destination=process.argv[3];
if(!source||!destination)throw new Error('用法：node scripts/export-visual.mjs <原生片段绝对路径> <离线HTML路径>');
if(resolve(source)===resolve(destination))throw new Error('不得覆盖聊天原生片段');
const fragment=await readFile(source,'utf8');
if(Buffer.byteLength(fragment)>200000||/<!doctype\s|<\s*(?:html|head|body)(?:\s|>)/i.test(fragment))throw new Error('源文件必须是小于 200 KB 的 HTML 片段');
if(/<(?:script|link|img|image|iframe)\b[^>]*(?:src|href)\s*=\s*["'](?!data:|#)/i.test(fragment)||/@import\s/i.test(fragment)||/url\(\s*["']?(?:https?:|\/\/|file:)/i.test(fragment)||/\b(?:fetch|XMLHttpRequest|WebSocket|import)\s*\(/.test(fragment))throw new Error('教学图解须独立运行，不使用网络或外部资源');
const scripts=[...fragment.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match=>match[1]).join('\n');
// CSS selectors such as .lucide are inert styles, not calls to a host API.
if(/\b(?:lucide|Tweak|vizCalendar)\b|\b(?:window|globalThis)\.openai\.(?!widgetState\b|setWidgetState\b)/.test(scripts)||/<[^>]+\bdata-lucide\s*=/i.test(fragment)||/<viz-calendar\b/i.test(fragment))throw new Error('教学图解含不可独立运行的宿主能力，请改用自身控件与直接标签');
const stylesheet=await readFile(fileURLToPath(new URL('../assets/visualize.css',import.meta.url)),'utf8');
const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
const bridge=`<script>window.openai={widgetState:null,setWidgetState:async value=>{window.openai.widgetState=value}};document.addEventListener('click',event=>{const tab=event.target.closest('[role="tab"]');if(!tab)return;const group=tab.closest('[role="tablist"]');if(!group)return;for(const item of group.querySelectorAll('[role="tab"]')){const active=item===tab;item.setAttribute('aria-selected',String(active));item.classList.toggle('active',active);const panel=document.getElementById(item.getAttribute('aria-controls'));if(panel)panel.hidden=!active}});</script>`;
const document=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${stylesheet}\n:root{color-scheme:light}body{margin:0;padding:12px}</style></head><body>${bridge}${fragment}</body></html>`;
if(Buffer.byteLength(document)>200000)throw new Error('图解加上独立样式后超过归档上限 200 KB，请简化源码');
await mkdir(dirname(resolve(destination)),{recursive:true});await writeFile(destination,document,{mode:0o600});
console.log(JSON.stringify({source:resolve(source),offlinePath:resolve(destination),bytes:Buffer.byteLength(document)}));
