import { requireOwner, HttpError } from '@/lib/server/auth';
import { readWorkspace, getObject } from '@/lib/server/store';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {await requireOwner();const {id}=await params,{state}=await readWorkspace(),asset=state.assets.find(a=>a.id===id);if(!asset)throw new HttpError(404,'Image not found.');return new Response(new Uint8Array(await getObject(asset.storageKey)),{headers:{'Content-Type':asset.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  catch(error){return new Response(error instanceof HttpError?error.message:'Image not found.',{status:error instanceof HttpError?error.status:404});}
}
