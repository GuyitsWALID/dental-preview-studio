import { configured, localDemo } from '@/lib/server/auth';
import { readWorkspace, getObject } from '@/lib/server/store';
import { resolvePreview } from '@/lib/publication';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;path?:string[]}>}) {
  const headers={'X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"frame-ancestors 'self'"};
  try {
    if(!configured() && !localDemo())return new Response('Preview not found.',{status:404,headers});
    const {slug,path=[]}=await params,{state}=await readWorkspace(),resolved=resolvePreview(state,slug,path);
    if(!resolved)return new Response('Preview not found.',{status:404,headers});
    return new Response(new Uint8Array(await getObject(resolved.file.key)),{headers:{...headers,'Content-Type':resolved.file.mime}});
  }catch{return new Response('The preview is temporarily unavailable.',{status:503,headers});}
}
