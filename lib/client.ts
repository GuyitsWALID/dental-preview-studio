'use client';
import { createClient } from '@supabase/supabase-js';
import type { Asset, WorkspaceRecord } from './types';
import type { MapsFacts } from './places';
import type { SiteReview } from './site/types';
export interface MapsPhoto { path:string; alt:string; width:number; height:number }
export interface MapsInfo { facts:MapsFacts; reviews:SiteReview[]; photos:MapsPhoto[] }
export async function readResponse<T>(response:Response):Promise<T> {
  const result=await response.json();
  if(!response.ok){if(response.status===401 && typeof window!=='undefined')window.location.assign('/login');throw new Error(result.error || 'The request could not be completed.');}
  return result as T;
}
export const studioAction = <T=Record<string,unknown>>(body:Record<string,unknown>) => fetch('/api/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(readResponse<T>);
export const refreshWorkspace = () => fetch('/api/studio',{cache:'no-store'}).then(readResponse<WorkspaceRecord>);
export const importImageUrl = async (url:string):Promise<Asset> => (await studioAction<{asset:Asset}>({action:'importImageUrl',url})).asset;
export const fetchMapsInfo = (url:string,name:string,address:string) => studioAction<MapsInfo>({action:'fetchMapsInfo',url,name,address});
export async function uploadImage(file:File,local:boolean):Promise<Asset> {
  if(file.size>5*1024*1024)throw new Error('Choose an image up to 5 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG, or WebP image.');
  if(local){const form=new FormData();form.set('file',file);return (await readResponse<{asset:Asset}>(await fetch('/api/upload',{method:'POST',body:form}))).asset;}
  const signed=await studioAction<{key:string;token:string;url:string;publishableKey:string}>({action:'signUpload',mime:file.type,bytes:file.size});
  const client=createClient(signed.url,signed.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.storage.from('studio').uploadToSignedUrl(signed.key,signed.token,file,{contentType:file.type});
  if(error)throw new Error('The upload failed. Try again.');
  return (await studioAction<{asset:Asset}>({action:'finalizeUpload',key:signed.key})).asset;
}
