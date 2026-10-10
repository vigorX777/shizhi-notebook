let tail=Promise.resolve();
export async function acquire(){let release!:()=>void;const next=new Promise<void>(r=>release=r);const previous=tail;tail=previous.then(()=>next);await previous;return release}
export async function exclusive<T>(run:()=>Promise<T>){const release=await acquire();try{return await run()}finally{release()}}
