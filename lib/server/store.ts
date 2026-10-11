import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile, rename, rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { initialWorkspace } from '../seed';
import type { Workspace, WorkspaceRecord } from '../types';
import { localDemo, ownerId, HttpError } from './auth';
// Development-only data must never be traced into production function bundles.
const workspaceRoot=process.cwd();
const root=path.resolve(/* turbopackIgnore: true */ workspaceRoot,process.env.STUDIO_LOCAL_DATA_DIR || '.local-studio');
if (!root.startsWith(workspaceRoot+path.sep)) throw new Error('Local studio data must stay inside this workspace.');
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function readWorkspace(): Promise<WorkspaceRecord> {
  if (localDemo()) {
    try { return JSON.parse(await readFile(path.join(root,'workspace.json'),'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code!=='ENOENT') throw error; return {revision:0,state:initialWorkspace()}; }
  }
  const db=adminClient();
  const {data,error}=await db.from('studio_workspaces').select('revision,state').eq('owner_id',ownerId()).maybeSingle();
  if (error) throw new HttpError(503,'The workspace could not be read. Check the Supabase migration and server settings.');
  if (data) return data as WorkspaceRecord;
  const first={owner_id:ownerId(),revision:0,state:initialWorkspace()};
  const created=await db.from('studio_workspaces').insert(first);
  if (created.error && created.error.code!=='23505') throw new HttpError(503,'The workspace could not be initialized. Check the owner account and migration.');
  if (created.error) return readWorkspace();
  return {revision:0,state:first.state};
}
let queue: Promise<unknown> = Promise.resolve();
export async function mutateWorkspace<T>(fn:(state:Workspace)=>T|Promise<T>, expectedRevision?:number): Promise<T> {
  const work=async()=>{
    const record=await readWorkspace();
    if (expectedRevision!=null && record.revision!==expectedRevision) throw new HttpError(409,'The workspace changed in another tab. Reload before saving.');
    const result=await fn(record.state);
    if (localDemo()) {
      await mkdir(root,{recursive:true});
      const temp=path.join(root,`workspace-${randomUUID()}.tmp`);
      await writeFile(temp,JSON.stringify({revision:record.revision+1,state:record.state}));
      // Windows file watchers/antivirus can briefly hold the destination open.
      // Retry the same atomic replace; never remove the current saved record.
      for(let attempt=0;;attempt++) {
        try {await rename(temp,path.join(root,'workspace.json'));break;}
        catch(error) {
          if(attempt>=8 || !['EPERM','EACCES','EBUSY'].includes((error as NodeJS.ErrnoException).code || '')) {await rm(temp,{force:true});throw new HttpError(503,'The local draft could not be saved. Retry after closing other file tools.');}
          await delay(50*(attempt+1));
        }
      }
    } else {
      const {data,error}=await adminClient().from('studio_workspaces').update({state:record.state,revision:record.revision+1}).eq('owner_id',ownerId()).eq('revision',record.revision).select('revision').maybeSingle();
      if (error) throw new HttpError(503,'Your changes could not be saved. Try again.');
      if (!data) throw new HttpError(409,'The workspace changed in another tab. Reload before saving.');
    }
    return result;
  };
  if (!localDemo()) return work();
  const next=queue.then(work,work); queue=next.catch(()=>{}); return next;
}
function localObject(key:string) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(key) || key.split('/').some(x=>x==='..' || x==='.' || !x)) throw new HttpError(400,'Invalid storage key.');
  const resolved=path.resolve(root,'objects',key);
  if (!resolved.startsWith(path.resolve(root,'objects')+path.sep)) throw new HttpError(400,'Invalid storage key.');
  return resolved;
}
export async function putObject(key:string,body:Uint8Array|string,mime:string) {
  if (localDemo()) {const file=localObject(key);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,body);return;}
  const {error}=await adminClient().storage.from('studio').upload(key,typeof body==='string'?Buffer.from(body):body,{contentType:mime.split(';')[0],upsert:false,cacheControl:'0'});
  if (error) throw new HttpError(503,'A file could not be stored. The existing preview is unchanged.');
}
export async function getObject(key:string):Promise<Buffer> {
  if (localDemo()) return readFile(localObject(key));
  const {data,error}=await adminClient().storage.from('studio').download(key);
  if (error || !data) throw new HttpError(404,'File not found.');
  return Buffer.from(await data.arrayBuffer());
}
export async function removeObject(key:string) {
  if (localDemo()) {await rm(localObject(key),{force:true});return;}
  const {error}=await adminClient().storage.from('studio').remove([key]);
  if (error) throw new HttpError(503,'The temporary upload could not be removed.');
}
export async function listObjects(prefix:string):Promise<{key:string;createdAt:string}[]> {
  if(localDemo()) {
    const dir=localObject(prefix);
    let names:string[];try {names=await readdir(dir);} catch(e) {if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
    return Promise.all(names.map(async name=>({key:prefix+'/'+name,createdAt:(await stat(path.join(dir,name))).birthtime.toISOString()})));
  }
  const files:{key:string;createdAt:string}[]=[];
  for(let offset=0;;offset+=1000) {
    const {data,error}=await adminClient().storage.from('studio').list(prefix,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
    if(error) throw new HttpError(503,'Temporary imports could not be checked. Try again.');
    for(const f of data || []) if(f.id && f.created_at) files.push({key:prefix+'/'+f.name,createdAt:f.created_at});
    if(!data || data.length<1000) return files;
  }
}
export async function downloadUrl(key:string,assetId:string) {
  if (localDemo()) return `/api/assets/${assetId}`;
  const {data,error}=await adminClient().storage.from('studio').createSignedUrl(key,300);
  if (error || !data) throw new HttpError(503,'The image download could not be prepared.');
  return data.signedUrl;
}
