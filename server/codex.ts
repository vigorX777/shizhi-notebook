import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {findCodexCommand,loadMachineEnvironment,appVersion} from '../shared/runtime.mjs';
export class CodexReader {
 private child:ReturnType<typeof spawn>;
 private counter=0;
 private closed=false;
 private failure:Error|undefined;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 private ready:Promise<unknown>;
 constructor(){
  loadMachineEnvironment();const cli=findCodexCommand();
  this.child=spawn(cli.command,[...cli.args,'app-server','--stdio'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  this.child.stderr!.resume();
  createInterface({input:this.child.stdout!}).on('line',line=>{try{const r=JSON.parse(line),p=this.pending.get(r.id);if(p){this.pending.delete(r.id);r.error?p.reject(new Error(r.error.message)):p.resolve(r.result)}}catch{}});
  const failed=(error:Error)=>{this.failure=error;for(const p of this.pending.values())p.reject(error);this.pending.clear()};
  this.child.on('error',failed);this.child.stdin!.on('error',failed);this.child.on('exit',()=>failed(new Error('Codex 连接已关闭')));
  this.ready=this.request('initialize',{clientInfo:{name:'shizhi_reader',title:'拾知只读归档',version:appVersion}}).then(()=>{
   if(this.closed||this.failure)throw this.failure||new Error('Codex 连接已关闭');
   this.child.stdin!.write(JSON.stringify({method:'initialized'})+'\n');
  });
  this.ready.catch(()=>{});
 }
 request(method:string,params:any):Promise<any>{
  if(this.closed||this.failure)return Promise.reject(this.failure||new Error('Codex 连接已关闭'));
  return new Promise((resolve,reject)=>{
   const id=++this.counter,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Codex ${method} 超时`))},15000);
   this.pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});
   this.child.stdin!.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){this.pending.get(id)?.reject(error);this.pending.delete(id)}});
  });
 }
 async connect(){await this.ready}
 async read(threadId:string){await this.connect();return (await this.request('thread/read',{threadId,includeTurns:true})).thread}
 close(){this.closed=true;for(const p of this.pending.values())p.reject(new Error('Codex 连接已关闭'));this.pending.clear();this.child.kill()}
}
