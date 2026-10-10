export type Highlight={id:string;contentKey:string;exact:string;prefix:string;suffix:string;start:number};
export function locateHighlight(text:string,highlight:Highlight){
 const matches:number[]=[];let from=0;
 while(from<=text.length){const index=text.indexOf(highlight.exact,from);if(index<0)break;matches.push(index);from=index+1}
 const contextual=matches.filter(index=>(!highlight.prefix||text.slice(Math.max(0,index-highlight.prefix.length),index)===highlight.prefix)&&(!highlight.suffix||text.slice(index+highlight.exact.length,index+highlight.exact.length+highlight.suffix.length)===highlight.suffix));
 if(contextual.length===1)return contextual[0];
 if(contextual.includes(highlight.start))return highlight.start;
 // A unique quote survives surrounding edits; an ambiguous quote is never
 // silently moved onto another sentence.
 return matches.length===1?matches[0]:null;
}
