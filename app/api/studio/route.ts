import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireOwner, assertSameOrigin, HttpError, localDemo, ownerId } from '@/lib/server/auth';
import { readWorkspace, mutateWorkspace, adminClient, getObject, removeObject } from '@/lib/server/store';
import { publishProject, prepareExport, saveImage, useOliCover, configHash } from '@/lib/server/projects';
import { confirmImport } from '@/lib/server/imports';
import { createClinicConfig, slugify, validateSiteConfig, productionIssues, safeHttps } from '@/lib/site/renderer.mjs';
import type { ClinicSiteConfig } from '@/lib/site/types';
import { STAGES, factsOf, type LeadFacts, type Prospect, type Project } from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail = (error:unknown) => NextResponse.json({error:error instanceof Error?error.message:'The action could not be completed.'},{status:error instanceof HttpError?error.status:400});
const normalizedLeadKey=(name:string,address:string)=>`${name.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ')}|${address.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ')}`;
const mapsPlaceId=(url:string)=>{try{const parsed=new URL(url);return parsed.searchParams.get('query_place_id') || parsed.searchParams.get('place_id') || '';}catch{return '';}};
export async function GET() {
  try {
    await requireOwner();
    // Source provenance can make a confirmed workspace exceed Vercel's
    // buffered response limit. Stream JSON in bounded chunks after auth.
    const bytes=new TextEncoder().encode(JSON.stringify(await readWorkspace()));
    let offset=0;
    const body=new ReadableStream<Uint8Array>({pull(controller){
      if(offset>=bytes.length){controller.close();return;}
      controller.enqueue(bytes.subarray(offset,offset+65536));offset+=65536;
    }});
    return new Response(body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',...(localDemo()?{'X-Studio-Mode':'local-demo'}:{})}});
  } catch(error) {return fail(error);}
}
export async function POST(request:Request) {
  try {
    await requireOwner(); assertSameOrigin(request);
    if (Number(request.headers.get('content-length'))>2*1024*1024) throw new HttpError(413,'This request is too large.');
    const body=await request.json(), action=body.action;
    if (action==='confirmImport') return NextResponse.json(await confirmImport(String(body.importId || ''),body.revision,body.acceptSkipped===true,body.useAsCurrentList===true),{headers:{'Cache-Control':'private, no-store'}});
    if (action==='publish') {return NextResponse.json({url:await publishProject(body.projectId)});}
    if (action==='export') {
      const {state}=await readWorkspace(), project=state.projects.find(p=>p.id===body.projectId);
      if (!project) throw new HttpError(404,'Clinic project not found.');
      const mode=body.mode==='production'?'production':'draft';
      if (mode==='production') {const issues=productionIssues(project.config);if(issues.length)throw new HttpError(400,issues.join('\n'));}
      return NextResponse.json(await prepareExport(project,mode),{headers:{'Cache-Control':'private, no-store'}});
    }
    if (action==='signUpload') {
      if (localDemo()) throw new HttpError(400,'Use the local upload route in local development.');
      if (!['image/jpeg','image/png','image/webp'].includes(body.mime) || !Number.isFinite(body.bytes) || body.bytes<1 || body.bytes>5*1024*1024) throw new HttpError(400,'Use a JPEG, PNG, or WebP up to 5 MB.');
      const key=`${ownerId()}/uploads/${randomUUID()}`;
      const {data,error}=await adminClient().storage.from('studio').createSignedUploadUrl(key);
      if (error || !data) throw new HttpError(503,'The upload could not be prepared.');
      return NextResponse.json({key,token:data.token,url:process.env.NEXT_PUBLIC_SUPABASE_URL,publishableKey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});
    }
    if (action==='finalizeUpload') {
      const key=String(body.key || '');
      if (!new RegExp(`^${ownerId()}/uploads/[a-f0-9-]{36}$`).test(key)) throw new HttpError(400,'Invalid upload reference.');
      try {return NextResponse.json({asset:await saveImage(await getObject(key))});}
      finally {await removeObject(key);}
    }
    if (action==='oliCover') return NextResponse.json({asset:await useOliCover(body.projectId)});
    const result=await mutateWorkspace(state=>{
      if (action==='updateProspect') {
        const p=state.prospects.find(p=>p.id===body.id);if(!p)throw new HttpError(404,'Prospect not found.');
        if (body.stage!==undefined) {if(!STAGES.includes(body.stage))throw new HttpError(400,'Choose a valid outreach stage.');p.stage=body.stage;}
        if (typeof body.shortlisted==='boolean') p.shortlisted=body.shortlisted;
        if (typeof body.notes==='string') p.notes=body.notes.slice(0,10000);
        if (body.overrides && typeof body.overrides==='object') {
          const allowed=['name','address','phone','email','mapsUrl','rating','reviews'];
          const overrides:Partial<LeadFacts>={};
          for (const key of allowed) if(Object.hasOwn(body.overrides,key)) {
            const value=body.overrides[key];
            if(['rating','reviews'].includes(key)){if(value!==null && !Number.isFinite(value))throw new HttpError(400,'Enter a valid number.');}
            else if(typeof value!=='string' || value.length>3000)throw new HttpError(400,'A prospect field is invalid.');
            (overrides as Record<string,unknown>)[key]=value;
            if (key==='rating' && value!==null && (value<0 || value>5))throw new HttpError(400,'Rating must be between 0 and 5.');
            if (key==='reviews' && value!==null && (value<0 || !Number.isInteger(value)))throw new HttpError(400,'Review count must be a nonnegative whole number.');
          }
          p.overrides=overrides;
        }
        if (body.recheck) {
          if (!['Not rechecked','No website found','Website found'].includes(body.recheck.status))throw new HttpError(400,'Invalid verification status.');
          if (body.recheck.url && !safeHttps(body.recheck.url))throw new HttpError(400,'Website verification links must use HTTPS.');
          p.recheck={status:body.recheck.status,url:String(body.recheck.url || '').slice(0,3000),checkedAt:String(body.recheck.checkedAt || '').slice(0,10)};
        }
        return {id:p.id};
      }
      if (action==='addMapsProspect') {
        const incoming=body.facts;
        if(!incoming || typeof incoming!=='object')throw new HttpError(400,'Enter the clinic details.');
        const value=(key:string,max=3000)=>typeof incoming[key]==='string'?incoming[key].trim().slice(0,max):'';
        const name=value('name',300),address=value('address'),phone=value('phone',40),email=value('email',320),mapsUrl=value('mapsUrl'),evidence=value('evidence',10000);
        const rating=incoming.rating==null?null:Number(incoming.rating),reviews=incoming.reviews==null?null:Number(incoming.reviews);
        if(!name)throw new HttpError(400,'Clinic name is required.');
        const mapsHosts=['www.google.com','google.com','maps.google.com','maps.app.goo.gl','goo.gl'];
        if(!safeHttps(mapsUrl,mapsHosts))throw new HttpError(400,'Use a valid HTTPS Google Maps place URL.');
        if(phone && !/^\+[1-9][0-9 ()-]{6,24}$/.test(phone))throw new HttpError(400,'Use an international phone number beginning with +.');
        if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Enter a valid email address.');
        if(rating!==null && (!Number.isFinite(rating) || rating<0 || rating>5))throw new HttpError(400,'Rating must be between 0 and 5.');
        if(reviews!==null && (!Number.isInteger(reviews) || reviews<0))throw new HttpError(400,'Review count must be a nonnegative whole number.');
        const placeId=mapsPlaceId(mapsUrl),fallback=normalizedLeadKey(name,address);
        const placeMatches=placeId?state.prospects.filter(p=>mapsPlaceId(p.source.mapsUrl)===placeId):[];
        const fallbackMatches=state.prospects.filter(p=>normalizedLeadKey(p.source.name,p.source.address)===fallback);
        if(placeMatches.length>1 || fallbackMatches.length>1)throw new HttpError(409,'Multiple prospects match this clinic. Review the existing records before adding it.');
        if(placeId && fallbackMatches[0] && mapsPlaceId(fallbackMatches[0].source.mapsUrl) && mapsPlaceId(fallbackMatches[0].source.mapsUrl)!==placeId)throw new HttpError(409,'The clinic name and address match a different Google Maps place ID. Review the existing record.');
        const existing=placeMatches[0] || fallbackMatches[0];
        if(existing){if(state.outreachList && !state.outreachList.prospectIds.includes(existing.id))state.outreachList.prospectIds.push(existing.id);return {id:existing.id,kind:'existing' as const};}
        const now=new Date().toISOString(),id=randomUUID();
        const source:LeadFacts={name,address,phone,email,socialNotes:'',socialUrls:[],rating,reviews,websiteStatus:'No owned website found — verify before outreach',seoPresence:'',aeoPresence:'',confidence:'Medium',evidence:evidence || 'Added manually from a Google Maps listing.',mapsUrl,verificationSource:mapsUrl,score:null,priority:'',importedStage:'',notes:''};
        const prospect:Prospect={id,source,provenance:{filename:'Manual Google Maps entry',sheet:'Quick add',row:0,researchDate:now.slice(0,10),importedAt:now,raw:{}},overrides:{},notes:'',stage:'Not contacted',shortlisted:false,recheck:{status:'Not rechecked',url:'',checkedAt:''}};
        state.prospects.push(prospect);state.outreachList?.prospectIds.push(id);
        return {id,kind:'new' as const};
      }
    if (action==='createProject') {
        const p=state.prospects.find(p=>p.id===body.prospectId);if(!p)throw new HttpError(404,'Prospect not found.');
        const existing=state.projects.find(p=>p.prospectId===body.prospectId);if(existing)return {id:existing.id};
        const f=factsOf(p),config=createClinicConfig({name:f.name,address:f.address,phone:f.phone,mapsUrl:f.mapsUrl,rating:f.rating,reviews:f.reviews,checkedAt:p.provenance.researchDate});
        const stem=slugify(f.name);let slug=stem,n=2;while(state.projects.some(p=>p.slug===slug))slug=`${stem}-${n++}`;
        const project:Project={id:randomUUID(),prospectId:p.id,slug,config,updatedAt:new Date().toISOString(),publishedReleaseId:null,publishedConfigHash:null};
        state.projects.push(project);return {id:project.id};
      }
      if (action==='saveProject') {
        const p=state.projects.find(p=>p.id===body.id);if(!p)throw new HttpError(404,'Clinic project not found.');
        const config=body.config as ClinicSiteConfig,errors=validateSiteConfig(config);
        if (errors.length)throw new HttpError(400,errors.join('\n'));
        // Only the known public configuration fields enter project storage/export.
        const clean=Object.fromEntries(Object.keys(createClinicConfig()).map(k=>[k,(config as unknown as Record<string,unknown>)[k]])) as unknown as ClinicSiteConfig;
        const slug=slugify(body.slug || p.slug);
        if (p.publishedConfigHash && slug!==p.slug)throw new HttpError(400,'The preview slug is locked after first publication.');
        if (state.projects.some(x=>x.id!==p.id && x.slug===slug))throw new HttpError(400,'Another project uses that preview slug.');
        p.config=clean;p.slug=slug;p.updatedAt=new Date().toISOString();return {id:p.id,hash:configHash(clean)};
      }
      if (action==='unpublish') {
        const p=state.projects.find(p=>p.id===body.projectId);if(!p)throw new HttpError(404,'Clinic project not found.');
        p.publishedReleaseId=null;return {id:p.id};
      }
      throw new HttpError(400,'Unknown studio action.');
    },body.revision);
    return NextResponse.json(result);
  } catch(error) {return fail(error);}
}
