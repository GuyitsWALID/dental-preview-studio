import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export const localDemo = () => process.env.NODE_ENV === 'development' && process.env.STUDIO_LOCAL_DEMO === '1';
export const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY && process.env.STUDIO_OWNER_ID);
export function ownerId() { return localDemo()?'00000000-0000-4000-8000-000000000099':process.env.STUDIO_OWNER_ID!; }
export async function sessionClient() {
  const jar=await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookies:{getAll:()=>jar.getAll(),setAll:values=>{try { values.forEach(({name,value,options})=>jar.set(name,value,{...options,httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'})); } catch { /* Server render cannot set cookies; route handlers refresh sessions. */ }}}
  });
}
export class HttpError extends Error { constructor(public status:number,message:string) { super(message); } }
export async function requireOwner() {
  if (localDemo()) return ownerId();
  if (!configured()) throw new HttpError(503,'Configure Supabase and your owner account to open the studio.');
  const client=await sessionClient();
  const {data,error}=await client.auth.getUser();
  if (error || !data.user || data.user.id!==ownerId()) throw new HttpError(401,'Sign in with the studio owner account.');
  return data.user.id;
}
export function assertSameOrigin(request: Request) {
  // Next's internal URL can use localhost behind its dev/reverse proxy. Compare
  // the browser Origin to the actual request Host, keeping scheme validation.
  const origin=request.headers.get('origin'),host=request.headers.get('host');
  try {const u=new URL(origin || '');if(!['http:','https:'].includes(u.protocol) || u.protocol!==new URL(request.url).protocol || u.host!==host || u.origin!==origin)throw new Error();}
  catch {throw new HttpError(403,'This action must come from the studio.');}
}
