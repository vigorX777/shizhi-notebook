// Codex/ChatGPT often use \(...\) and \[...\]; remark-math expects $ / $$.
// Preserve fenced blocks and inline code verbatim, including diagram programs.
export function normalizeMath(text:string){
 const protectedParts: string[]=[];
 const protectedText=text.replace(/(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\2[^\n]*(?:\n|$))|(`+)[^\n]*?\3/gm,value=>{
  protectedParts.push(value);return `\u0000${protectedParts.length-1}\u0000`;
 });
 return protectedText.replace(/\\\[([\s\S]*?)\\\]/g,(_,formula)=>`\n\n$$\n${formula.trim()}\n$$\n\n`)
  .replace(/\\\((.*?)\\\)/gs,(_,formula)=>`$${formula.trim()}$`)
  .replace(/\u0000(\d+)\u0000/g,(_,index)=>protectedParts[Number(index)]);
}
export const visualizationCsp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
export function visualDocument(source:string){return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${visualizationCsp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:16px;color:#233044}svg,canvas,img{max-width:100%}</style>${source}`;}
