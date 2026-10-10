import {insideDirectory} from '../shared/runtime.mjs';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {homedir} from 'node:os';
import {z} from 'zod';
import {learningRoot} from './config.js';
import {imageMime} from './attachments.js';

export const visualizationSchema=z.array(z.object({path:z.string().min(1),offlinePath:z.string().min(1).optional(),label:z.string().max(200).default('学习图解')})).max(10);
export const storedVisualsSchema=z.array(z.object({reference:z.string(),markdown:z.string()})).max(10);
export type StoredVisual=z.infer<typeof storedVisualsSchema>[number];
export async function preserveVisualizations(items:z.infer<typeof visualizationSchema>){
 const visuals:StoredVisual[]=[];
 for(const item of items){
  const referencePath=await realpath(resolve(item.path));
  if(!insideDirectory(referencePath,await realpath(learningRoot))&&!insideDirectory(referencePath,resolve(process.env.CODEX_HOME||resolve(homedir(),'.codex'),'visualizations')))throw new Error('图解文件必须是当前学习项目或明确提交的 Codex 可视化产物');
  const path=item.offlinePath?await realpath(resolve(item.offlinePath)):referencePath;
  if(!insideDirectory(path,await realpath(learningRoot))&&!insideDirectory(path,resolve(process.env.CODEX_HOME||resolve(homedir(),'.codex'),'visualizations')))throw new Error('图解文件必须是当前学习项目或明确提交的 Codex 可视化产物');
  const bytes=await readFile(path);if(bytes.length>5*1024*1024)throw new Error('单个讲解图解超过 5 MB');
  let mime:string|undefined;try{mime=imageMime(bytes)}catch{}let markdown:string;
  if(mime)markdown=`![${item.label.replace(/[\[\]\n]/g,'')}](${`data:${mime};base64,${bytes.toString('base64')}`})`;
  else{
   const extension=extname(path).toLowerCase();const kind=extension==='.svg'?'svg':extension==='.html'?'learning-html':null;
   if(!kind)throw new Error('图解支持 PNG/JPEG/GIF/WebP、SVG 或独立 HTML');
   const content=bytes.toString('utf8');if(content.includes('\uFFFD'))throw new Error('图解必须是 UTF-8 文本');
   if(bytes.length>200000)throw new Error('文字图解超过 200 KB');
   const longest=Math.max(2,...Array.from(content.matchAll(/`+/g),m=>m[0].length));const fence='`'.repeat(longest+1);
   markdown=`${fence}${kind}\n${content}\n${fence}`;
  }
  visuals.push({reference:item.path,markdown});
 }
 return visuals;
}
export function embedVisualizations(text:string,visuals:StoredVisual[]){
 const byPath=new Map(visuals.map(visual=>[visual.reference,visual.markdown]));
 // The official inline visualization reference is response content, not a
 // Markdown link. Read only files explicitly submitted by the learning tool.
 text=text.replace(/visualize(\{[^\n]*?\})/g,(reference,json)=>{
  try{const value=JSON.parse(json);return typeof value.path==='string'&&byPath.has(value.path)?`\n\n${byPath.get(value.path)}\n\n`:reference}catch{return reference}
 });
 for(const visual of visuals){
  // Match only the submitted artifact, never read an arbitrary path from Markdown.
  const escaped=visual.reference.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const encoded=encodeURI(visual.reference).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  text=text.replace(new RegExp(`!?\\[[^\\]]*\\]\\((?:<(?:${escaped}|${encoded})>|(?:${escaped}|${encoded}))(?:\\s+"[^"]*")?\\)`,'g'),()=>`\n\n${visual.markdown}\n\n`);
 }
 return text;
}
export function visualReferenceError(text:string,attachmentIds?:Set<string>){
 // Example code is not a missing picture. Only actual Markdown images and the
 // resource declarations of rendered visual blocks affect completeness.
 const visualBlocks:string[]=[];
 const markdown=text.replace(/^ {0,3}(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^ {0,3}\1[^\n]*(?:\n|$)/gm,(_,fence,language,body)=>{if(['svg','learning-html'].includes(language.trim()))visualBlocks.push(body);return ''}).replace(/(`+)[^\n]*?\1/g,'');
 if(markdown.includes('visualize'))return '聊天交互图解尚未独立归档，请提交对应图解文件及离线导出';
 for(const match of markdown.matchAll(/(!?)\[[^\]]*\]\(([^\n)]+)\)/g)){
  const url=match[2].replace(/^<|>$/g,'');
  const attachmentId=url.startsWith('attachment:')?url.slice(11):url.startsWith('/api/v1/attachments/')?url.slice(20):null;
  if(attachmentId&&attachmentIds&&!attachmentIds.has(attachmentId))return '讲解引用的原图不存在或不属于本笔记';
  if(match[1]&&!url.startsWith('attachment:')&&!url.startsWith('/api/v1/attachments/')&&!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(url))return '讲解图片尚未独立归档';
  if(!match[1]&&/^(?:\/|[a-z]:[\\/]|\\\\|file:)/i.test(url)&&!url.startsWith('/api/v1/')&&/\.(html|svg|png|jpe?g|webp|gif)$/i.test(url))return '讲解可视化文件尚未独立归档';
 }
 const visual=visualBlocks.join('\n');
 if(/<(?:script|img|link|image|iframe)\b[^>]*(?:src|href)\s*=\s*["'](?!data:|#)[^"']+/i.test(visual)||/@import\s/i.test(visual)||/url\(\s*["']?(?:https?:|\/\/|file:)/i.test(visual))return '图解依赖外部文件，请导出为独立离线图解';
 return null;
}
