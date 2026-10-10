import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Content} from './Content.js';
import {locateHighlight,type Highlight} from './highlight-anchors.js';

const ignored='.katex,.diagram,.interactive-visual,script,style,button,input,summary';
function textNodes(root:HTMLElement){
 const nodes:Text[]=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest(ignored)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
 while(walker.nextNode())nodes.push(walker.currentNode as Text);return nodes;
}
function applyMarks(root:HTMLElement,highlights:Highlight[]){
 for(const mark of root.querySelectorAll('mark[data-learning-highlight]'))mark.replaceWith(...mark.childNodes);
 root.normalize();const nodes=textNodes(root),text=nodes.map(node=>node.data).join('');
 const intervals=highlights.map(highlight=>{const start=locateHighlight(text,highlight);return start===null?null:{id:highlight.id,start,end:start+highlight.exact.length}}).filter((value):value is {id:string;start:number;end:number}=>value!==null);
 let offset=0;
 for(const node of nodes){
  const relevant=intervals.filter(interval=>interval.start<offset+node.length&&interval.end>offset);if(!relevant.length){offset+=node.length;continue}
  const cuts=[...new Set([0,node.length,...relevant.flatMap(interval=>[Math.max(0,interval.start-offset),Math.min(node.length,interval.end-offset)])])].sort((a,b)=>a-b);
  const fragment=document.createDocumentFragment();for(let index=1;index<cuts.length;index++){
   const start=cuts[index-1],end=cuts[index],ids=relevant.filter(interval=>interval.start<offset+end&&interval.end>offset+start).map(interval=>interval.id);
   const piece=document.createTextNode(node.data.slice(start,end));if(ids.length){const mark=document.createElement('mark');mark.dataset.learningHighlight=ids.join(',');mark.append(piece);fragment.append(mark)}else fragment.append(piece);
  }
  offset+=node.length;node.replaceWith(fragment);
 }
}
type Pick={highlight:Highlight;removeIds:string[];left:number;top:number};
export function AnnotatedContent({text,contentKey,highlights,onChange,busy}:{text:string;contentKey:string;highlights:Highlight[];onChange:(highlights:Highlight[])=>Promise<void>;busy:boolean}){
 const root=useRef<HTMLDivElement>(null),[pick,setPick]=useState<Pick|null>(null);
 const currentMarks=JSON.stringify(highlights.filter(highlight=>highlight.contentKey===contentKey));
 useEffect(()=>{if(root.current)applyMarks(root.current,JSON.parse(currentMarks));setPick(null)},[text,currentMarks,contentKey]);
 useEffect(()=>{
  const update=()=>{
   const selection=window.getSelection(),element=root.current;
   if(!selection||selection.isCollapsed||!selection.rangeCount||!element){setPick(null);return}
   const range=selection.getRangeAt(0);
   if(!element.contains(range.startContainer)||!element.contains(range.endContainer)||[...element.querySelectorAll(ignored)].some(node=>range.intersectsNode(node))){setPick(null);return}
   const nodes=textNodes(element);let offset=0,start=-1,end=-1;
   for(const node of nodes){if(node===range.startContainer)start=offset+range.startOffset;if(node===range.endContainer)end=offset+range.endOffset;offset+=node.length}
   if(start<0||end<=start||end-start>5000){setPick(null);return}
   const plain=nodes.map(node=>node.data).join('');while(start<end&&/\s/.test(plain[start]))start++;while(end>start&&/\s/.test(plain[end-1]))end--;
   if(end===start){setPick(null);return}
   const removeIds=highlights.filter(highlight=>highlight.contentKey===contentKey).filter(highlight=>{const position=locateHighlight(plain,highlight);return position!==null&&position<end&&position+highlight.exact.length>start}).map(highlight=>highlight.id);
   const rect=range.getBoundingClientRect();
   if(rect.bottom<0||rect.top>innerHeight){setPick(null);return}
   setPick({highlight:{id:crypto.randomUUID(),contentKey,exact:plain.slice(start,end),prefix:plain.slice(Math.max(0,start-40),start),suffix:plain.slice(end,end+40),start},removeIds,left:Math.max(8,Math.min(innerWidth-144,rect.left+rect.width/2-64)),top:Math.max(8,Math.min(innerHeight-56,rect.top>=58?rect.top-52:rect.bottom+8))});
  };
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setPick(null);window.getSelection()?.removeAllRanges()}};
  document.addEventListener('selectionchange',update);window.addEventListener('scroll',update,true);window.addEventListener('resize',update);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('selectionchange',update);window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);document.removeEventListener('keydown',escape)};
 },[highlights,contentKey]);
 async function toggle(){if(!pick)return;await onChange(pick.removeIds.length?highlights.filter(highlight=>!pick.removeIds.includes(highlight.id)):[...highlights,pick.highlight]);window.getSelection()?.removeAllRanges();setPick(null)}
 return <div ref={root} className="annotatable" data-content-key={contentKey}><Content key={text} text={text}/>{pick&&createPortal(<div className="selection-toolbar" style={{left:pick.left,top:pick.top}} role="toolbar" aria-label="划词标记"><button disabled={busy} onPointerDown={event=>event.preventDefault()} onClick={()=>void toggle()}>{pick.removeIds.length?'取消高亮':'设置高亮'}</button></div>,document.body)}</div>;
}
