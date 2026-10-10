import {z} from 'zod';
export const highlightSchema=z.object({id:z.string().uuid(),contentKey:z.string().min(1).max(300),exact:z.string().min(1).max(5000),prefix:z.string().max(80),suffix:z.string().max(80),start:z.number().int().nonnegative().max(5000000)}).strict();
export const highlightsSchema=z.array(highlightSchema).max(500).superRefine((items,context)=>{if(new Set(items.map(item=>item.id)).size!==items.length)context.addIssue({code:'custom',message:'高亮 ID 不得重复'})});
