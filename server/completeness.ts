export const unlinkedImagesError='原图尚未关联到笔记，等待补整理';

export function imagesLinked(
  attachments:Array<{id:string}>,
  links:Array<{attachmentIds:string}>,
){
  const referenced=new Set(links.flatMap(link=>JSON.parse(link.attachmentIds) as string[]));
  return attachments.every(attachment=>referenced.has(attachment.id));
}
