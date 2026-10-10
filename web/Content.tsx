import React,{useEffect,useState,useId} from 'react';
import Markdown,{type Components} from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';
import {normalizeMath,visualDocument} from './content-format.js';
import 'katex/dist/katex.min.css';

function safeSvg(source:string){
 const clean=DOMPurify.sanitize(source,{USE_PROFILES:{svg:true,svgFilters:true},ADD_TAGS:['style'],FORBID_TAGS:['foreignObject','a']});
 const document=new DOMParser().parseFromString(clean,'image/svg+xml');
 for(const element of document.querySelectorAll('[href], [*|href]'))for(const attribute of [...element.attributes]){
  if(attribute.localName!=='href')continue;
  const value=attribute.value;
  if(!value.startsWith('#')&&!(element.localName==='image'&&/^data:image\/(png|jpeg|gif|webp);base64,/i.test(value)))element.removeAttributeNode(attribute);
 }
 const svg=new XMLSerializer().serializeToString(document.documentElement);
 // CSS paint servers may reference local definitions, never remote resources.
 return svg.replace(/@import[^;]+;/gi,'').replace(/url\(([^)]+)\)/gi,(full,target)=>target.trim().replace(/^['"]|['"]$/g,'').startsWith('#')?full:'none');
}
function Diagram({source,kind}:{source:string;kind:string}){
 const id=useId().replace(/[^a-z0-9]/gi,'');
 const [svg,setSvg]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setSvg('');setError('');
  if(kind==='svg'){const result=safeSvg(source);if(/<svg[\s>]/.test(result))setSvg(result);else setError('图解格式无效');return}
  import('mermaid').then(async({default:mermaid})=>{
   mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral',fontFamily:'system-ui, sans-serif',flowchart:{htmlLabels:false},suppressErrorRendering:true,maxTextSize:100000});
   const result=await mermaid.render('learning'+id,source);
   if(active)setSvg(safeSvg(result.svg));
  }).catch(()=>{if(active)setError('图解暂时无法渲染，原始内容已保留。')});
  return()=>{active=false};
 },[source,kind,id]);
 return <figure className="diagram"><div role="img" aria-label="学习图解" className="diagram-image">{svg&&<img src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)} alt="学习图解"/>}</div>{error?<p role="alert">{error}</p>:!svg&&<p>正在绘制图解…</p>}<details><summary>查看图解原文</summary><pre><code>{source}</code></pre></details></figure>;
}
function CodeBlock({children,...props}:React.ComponentProps<'pre'>){
 const child=React.isValidElement<{className?:string;children?:React.ReactNode}>(children)?children:null;
 const language=child?.props.className?.match(/language-([^\s]+)/)?.[1];
 const source=String(child?.props.children??'').replace(/\n$/,'');
 if(language==='mermaid'||language==='svg')return <Diagram source={source} kind={language}/>;
 if(language==='learning-html')return <figure className="interactive-visual"><iframe title="交互式学习图解" sandbox="allow-scripts" srcDoc={visualDocument(source)}/><details><summary>查看图解原文</summary><pre><code>{source}</code></pre></details></figure>;
 return <pre {...props}>{children}</pre>;
}
// Stable component identities preserve an interactive frame when the notebook
// refreshes its data; new inline functions would remount it every ten seconds.
const components:Components={pre:({node,...props})=><CodeBlock {...props}/>,img:({src,alt})=>src?.startsWith('/api/v1/attachments/')||src?.startsWith('data:image/')?<img src={src} alt={alt||'学习图解'} loading="lazy"/>:<span className="visual-unavailable">此图片未独立归档，请查看题目原图或重新整理图解。</span>,a:({href,children})=><a href={href} target="_blank" rel="noreferrer">{children}</a>};
export const Content=React.memo(function Content({text}:{text:string}){return <div className="markdown"><Markdown
 remarkPlugins={[remarkMath,remarkGfm]} rehypePlugins={[[rehypeKatex,{strict:false,trust:false,throwOnError:false}]]}
 urlTransform={url=>url.startsWith('attachment:')?'/api/v1/attachments/'+encodeURIComponent(url.slice(11)):/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(url)?url:/^(https?:|mailto:|\/|#)/i.test(url)?url:''}
 components={components}
 >{normalizeMath(text)}</Markdown></div>});
