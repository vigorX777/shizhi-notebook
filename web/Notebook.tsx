import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
const covers:Record<string,{color:string;name:string}>={数学:{color:'#233f73',name:'math'},语文:{color:'#733745',name:'chinese'},英语:{color:'#276878',name:'english'},物理:{color:'#455c71',name:'physics'},化学:{color:'#645178',name:'chemistry'},生物:{color:'#3c6650',name:'biology'},地理:{color:'#28685f',name:'geography'},历史:{color:'#886041',name:'history'},'道德与法治':{color:'#51443c',name:'law'}};
function Motif({name}:{name:string}){
 const patterns:Record<string,React.ReactNode>={
 math:<><path d="M18 126H151M37 143V20M31 29l6-9 6 9M141 120l10 6-10 6M37 113L97 42l47 71ZM37 113H144M97 42V113"/><circle cx="97" cy="85" r="28"/><path d="M62 139h14m8 0h14"/></>,
 chinese:<><path d="M25 37q30-13 57 0v92q-28-13-57 0ZM82 37q28-13 57 0v92q-28-13-57 0M37 50h30m-30 14h30m-30 14h20m39-28h28m-28 14h28m-28 14h20"/><text x="48" y="110" fontSize="20">文</text></>,
 english:<><text x="21" y="55" fontSize="40">Aa</text><text x="79" y="94" fontSize="30">Bb</text><text x="28" y="129" fontSize="15">read · think</text><path d="M21 69h54m-54 7h35M79 107h53"/></>,
 physics:<><path d="M14 84q13-54 26 0t26 0t26 0t26 0t26 0M22 135L138 31m-20 4 20-4-4 20M13 108h138"/><circle cx="40" cy="45" r="13"/></>,
 chemistry:<><path d="M45 20h28m-24 0v39l-26 54q-5 13 9 13h55q14 0 8-13L69 59V20M37 94h44M93 49l19-12 21 12v25l-21 12-19-12ZM112 37V22M133 49l16-10M112 86v16"/><circle cx="48" cy="111" r="3"/><circle cx="64" cy="102" r="2"/></>,
 biology:<><path d="M34 133q-4-65 95-103-1 84-76 90M38 129l83-85M70 96l-2-31m18 14 28 1M52 112l-1-20"/><ellipse cx="120" cy="122" rx="25" ry="18"/><circle cx="122" cy="122" r="6"/></>,
 geography:<><circle cx="83" cy="76" r="52"/><ellipse cx="83" cy="76" rx="23" ry="52"/><path d="M31 76h104M39 48q44 17 88 0M39 104q44-17 88 0M83 24v104M22 145q23-20 45-7t47 0t36-1"/></>,
 history:<><path d="M83 22v116M33 45h100M38 91h90M33 138h100M38 26v19m12-11v11m12-17v17m12-11v11m30-17v17m12-11v11m12-17v17M42 110h27M102 67h26"/><circle cx="83" cy="45" r="5"/><circle cx="83" cy="91" r="5"/><circle cx="83" cy="138" r="5"/></>,
 law:<><path d="M83 30v99M36 50h94M45 50l-22 47h44ZM122 50l-22 47h44ZM22 97q23 29 45 0M100 97q22 29 44 0M59 130h48M48 139h71"/><circle cx="83" cy="27" r="5"/></>,
 index:<><rect x="26" y="29" width="111" height="104" rx="2"/><path d="M46 53h70M46 73h53M46 94h70M46 114h41M119 29V17h24v32"/></>
 };
 return <svg viewBox="0 0 166 158" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{patterns[name]||patterns.index}</svg>;
}
export function Book({subject}:{subject:string}){
 const cover=covers[subject]||{color:'#596371',name:'index'};
 return <span className="book-object" style={{'--cover':cover.color} as React.CSSProperties}><span className="book-pages"/><span className="book-front"><span className="book-spine"/><span className={"book-title"+(subject.length>6?" long-title":"")} title={subject}>{subject}</span><span className="book-motif"><Motif name={cover.name}/></span><span className="book-imprint">学习笔记</span><span className="book-binding"/></span></span>;
}
export type Opening={subject:string;rect:{left:number;top:number;width:number;height:number}};
export function BookOpening({opening,onDone,onCancel}:{opening:Opening;onDone:()=>void;onCancel:()=>void}){
 const element=useRef<HTMLDivElement>(null),callbacks=useRef({onDone,onCancel});callbacks.current={onDone,onCancel};
 useEffect(()=>{
  const root=element.current!,front=root.querySelector('.book-front') as HTMLElement;
  const width=Math.min(280,innerWidth*.62),scale=width/opening.rect.width;
  const left=(innerWidth-width)/2,top=Math.max(30,(innerHeight-opening.rect.height*scale)/2);
  const transform=`translate(${left-opening.rect.left}px,${top-opening.rect.top}px) scale(${scale})`;
  const move=root.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform,opacity:1,offset:.35},{transform,opacity:1,offset:.85},{transform,opacity:0}],{duration:700,easing:'cubic-bezier(.25,.7,.25,1)',fill:'forwards'});
  const flip=front.animate([{transform:'rotateY(0)'},{transform:'rotateY(0)',offset:.32},{transform:'rotateY(-145deg)',offset:.82},{transform:'rotateY(-145deg)'}],{duration:700,easing:'ease-in-out',fill:'forwards'});
  let cancelled=false;move.finished.then(()=>{if(!cancelled)callbacks.current.onDone()}).catch(()=>{});
  const cancel=()=>{cancelled=true;move.cancel();flip.cancel();callbacks.current.onCancel()};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel()};
  window.addEventListener('hashchange',cancel);window.addEventListener('popstate',cancel);window.addEventListener('keydown',escape);
  return()=>{cancelled=true;move.cancel();flip.cancel();window.removeEventListener('hashchange',cancel);window.removeEventListener('popstate',cancel);window.removeEventListener('keydown',escape)};
 },[opening]);
 return createPortal(<div className="book-opening" aria-hidden="true"><div className="opening-book" ref={element} style={{left:opening.rect.left,top:opening.rect.top,width:opening.rect.width,height:opening.rect.height}}><span className="opening-page"><span>{opening.subject}</span><i/><i/><i/><i/><i/></span><Book subject={opening.subject}/></div></div>,document.body);
}
