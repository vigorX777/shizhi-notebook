import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {attachmentsRoot} from './config.js';
export const MAX_IMAGE_BYTES=30*1024*1024;
export function imageMime(b:Buffer){if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(b.subarray(0,6).toString().startsWith('GIF8'))return 'image/gif';if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'image/webp';throw new Error('附件不是支持的原始图片（PNG/JPEG/GIF/WebP）')}
export async function saveOriginal(input:any){
 let bytes:Buffer;
 if(input.type==='localImage')bytes=await readFile(input.path);
 else if(typeof input.url==='string'&&input.url.startsWith('data:')){const m=input.url.match(/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/);if(!m)throw new Error('图片 data URL 格式不受支持');bytes=Buffer.from(m[1],'base64')}
 else throw new Error(input.fileId?'Codex 仅返回图片 fileId，尚未获得正式原图读取连接':'Codex 未提供独立可读取的原图；不会以链接或缩略图代替');
 if(!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw new Error('图片为空或超过 30 MB');
 const mime=imageMime(bytes);const sha256=createHash('sha256').update(bytes).digest('hex');
 const filename=sha256+'.'+mime.split('/')[1];const temp=join(attachmentsRoot,randomUUID()+'.tmp');
 await writeFile(temp,bytes,{mode:0o600});await rename(temp,join(attachmentsRoot,filename));return {filename,mime,sha256,bytes:bytes.length};
}
