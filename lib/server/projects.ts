import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { ownerId, HttpError } from './auth';
import { getObject, putObject, readWorkspace, mutateWorkspace, downloadUrl } from './store';
import { projectAssets, fileMime, releaseManifest } from '../publication';
import type { Asset, Project } from '../types';
export const configHash = (config:unknown) => createHash('sha256').update(JSON.stringify(config)).digest('hex');
export async function saveImage(bytes:Buffer):Promise<Asset> {
  if (bytes.length>5*1024*1024) throw new HttpError(400,'Images must be 5 MB or smaller.');
  const jpeg=bytes[0]===0xff && bytes[1]===0xd8;
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp=bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
  if (!jpeg && !png && !webp) throw new HttpError(400,'Upload a JPEG, PNG, or WebP image. SVG is not supported.');
  let image:Buffer,meta:Metadata;
  try {
    meta=await sharp(bytes,{limitInputPixels:20_000_000}).metadata();
    if ((meta.pages || 1)>1) throw new Error('Animated images are not supported');
    image=await sharp(bytes,{limitInputPixels:20_000_000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  } catch {throw new HttpError(400,'This image could not be decoded. Use a still JPEG, PNG, or WebP under 20 megapixels.');}
  if (image.length>2*1024*1024) throw new HttpError(400,'The optimized image is too large. Choose a smaller image.');
  const processed=await sharp(image).metadata(),id=randomUUID(),assetPath=`assets/${id}.webp`,storageKey=`${ownerId()}/assets/${id}.webp`;
  await putObject(storageKey,image,'image/webp');
  const asset={id,path:assetPath,storageKey,mime:'image/webp',width:processed.width!,height:processed.height!,bytes:image.length};
  await mutateWorkspace(state=>{state.assets.push(asset);}); return asset;
}
export async function useOliCover(projectId:string) {
  const {state}=await readWorkspace();
  const project=state.projects.find(p=>p.id===projectId);
  if (!project || project.prospectId!=='00000000-0000-4000-8000-000000000001') throw new HttpError(400,'The OLI cover is only available for the OLI example.');
  return saveImage(await readFile(path.join(process.cwd(),'public/assets/oli-facebook-cover.jpg')));
}
export async function fontFiles() {
  const names=['jakarta.woff2','jakarta-bold.woff2','manrope.woff2','manrope-bold.woff2','jakarta-LICENSE.txt','manrope-LICENSE.txt'];
  return Promise.all(names.map(async n=>({path:`assets/fonts/${n}`,bytes:await readFile(path.join(process.cwd(),'public/studio-fonts',n))})));
}
export async function publishProject(projectId:string) {
  const {state}=await readWorkspace(),project=state.projects.find(p=>p.id===projectId);
  if (!project) throw new HttpError(404,'Clinic project not found.');
  const hash=configHash(project.config),id=randomUUID(),manifest=releaseManifest(project,id),assets=projectAssets(project,state);
  const files:Record<string,{key:string;mime:string}>={};
  const payloads=[...Object.entries(manifest).map(([p,body])=>({path:p,bytes:Buffer.from(body)})),...await fontFiles(),...await Promise.all(assets.map(async a=>({path:a.path,bytes:await getObject(a.storageKey)})))];
  await Promise.all(payloads.map(async item=>{
    const key=`${ownerId()}/releases/${id}/${item.path}`,mime=fileMime(item.path);
    await putObject(key,item.bytes,mime); files[item.path]={key,mime};
  }));
  await mutateWorkspace(current=>{
    const p=current.projects.find(p=>p.id===projectId);
    if (!p || configHash(p.config)!==hash) throw new HttpError(409,'The draft changed during publication. Publish the saved draft again.');
    current.releases.push({id,projectId,createdAt:new Date().toISOString(),published:true,files});
    p.publishedReleaseId=id;p.publishedConfigHash=hash;
  });
  return `/preview/${project.slug}/`;
}
export async function prepareExport(project:Project,mode:'draft'|'production') {
  const {state}=await readWorkspace();
  const assets=projectAssets(project,state);
  const images=await Promise.all(assets.map(async a=>({path:a.path,url:await downloadUrl(a.storageKey,a.id)})));
  const sources:Record<string,string>={};
  for (const name of ['renderer.mjs','styles.mjs','runtime.mjs']) sources[name]=await readFile(path.join(process.cwd(),'lib/site',name),'utf8');
  return {config:project.config,slug:project.slug,mode,images,sources,fontUrls:(await fontFiles()).map(f=>({path:f.path,url:'/studio-fonts/'+f.path.split('/').at(-1)})),hasUnpublishedChanges:configHash(project.config)!==project.publishedConfigHash};
}
