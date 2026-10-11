import 'server-only';
import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { applyImport, previewImport, type ParsedImport, type ImportEntry } from '../prospects';
import type { ImportPayload } from '../import-preview';
import { ownerId, HttpError } from './auth';
import { putObject, getObject, removeObject, listObjects, readWorkspace, mutateWorkspace } from './store';

const ttl=60*60*1000, pageSize=50;
interface StagedImport {parsed:ParsedImport;entries:Omit<ImportEntry,'row'>[];revision:number;expiresAt:number}
function key(id:string) {
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)) throw new HttpError(400,'Invalid import reference.');
  return `${ownerId()}/imports/${id}.json`;
}
async function readStage(id:string):Promise<StagedImport> {
  let bytes:Buffer;
  try {bytes=await getObject(key(id));} catch(e) {
    if((e as NodeJS.ErrnoException).code==='ENOENT') throw new HttpError(404,'Import not found. Choose the workbook again.');
    throw e;
  }
  const envelope=JSON.parse(bytes.toString());
  const stage:StagedImport=JSON.parse(gunzipSync(Buffer.from(envelope.data,'base64'),{maxOutputLength:64*1024*1024}).toString());
  if(stage.expiresAt<=Date.now()) {await removeObject(key(id));throw new HttpError(410,'This import expired. Choose the workbook again.');}
  return stage;
}
function page(id:string,stage:StagedImport,offset:number):ImportPayload {
  if(!Number.isInteger(offset) || offset<0 || (offset>=stage.entries.length && offset!==0)) throw new HttpError(400,'Invalid import page.');
  const counts={new:0,update:0,unchanged:0,ambiguous:0,invalid:0};
  for(const e of stage.entries) counts[e.kind]++;
  // Preserve full source values privately. Bound the preview even for very long cells.
  const entries=stage.entries.slice(offset,offset+pageSize).map((e,i)=>{
    const row=stage.parsed.rows[offset+i];
    return {...e,...(row.research?{researchSummary:{reviews:row.research.reviews.length,assets:row.research.assets.length,coverage:String(row.research.details.values['Review coverage'] || '')}}:{}),row:{...row,research:undefined,
      facts:Object.fromEntries(Object.entries(row.facts).map(([k,v])=>[k,typeof v==='string'?v.slice(0,2000):Array.isArray(v)?v.slice(0,20).map(s=>s.slice(0,2000)):v])) as typeof row.facts,
      provenance:{...row.provenance,raw:{},links:undefined}}};
  });
  const {rows:_,...parsed}=stage.parsed;
  return {importId:id,parsed,entries,counts,totalRows:stage.entries.length,offset,nextOffset:offset+pageSize<stage.entries.length?offset+pageSize:null,revision:stage.revision,expiresAt:stage.expiresAt};
}
export async function stageImport(parsed:ParsedImport) {
  const prefix=`${ownerId()}/imports`;
  const expired=(await listObjects(prefix)).filter(f=>Date.parse(f.createdAt)+ttl<=Date.now());
  await Promise.all(expired.map(f=>removeObject(f.key)));
  const {state,revision}=await readWorkspace(),id=randomUUID();
  const stage:StagedImport={parsed,entries:previewImport(state.prospects,parsed).map(({row:_,...entry})=>entry),revision,expiresAt:Date.now()+ttl};
  // text/plain is already allowed in the private bucket. Compression keeps
  // a supported 2,000-row import below the bucket's 5 MB object limit.
  const body=JSON.stringify({encoding:'gzip-base64',data:gzipSync(JSON.stringify(stage)).toString('base64')});
  if(Buffer.byteLength(body)>5*1024*1024) throw new HttpError(413,'This workbook contains too much source text. Split it into smaller imports.');
  await putObject(key(id),body,'text/plain');
  return page(id,stage,0);
}
export async function importPage(id:string,offset:number) {return page(id,await readStage(id),offset);}
export async function cancelImport(id:string) {await removeObject(key(id));}
export async function confirmImport(id:string,revision:number,acceptSkipped:boolean) {
  const stage=await readStage(id);
  if(revision!==stage.revision) throw new HttpError(409,'Import revision does not match. Choose the workbook again.');
  const result=await mutateWorkspace(state=>{
    const entries=previewImport(state.prospects,stage.parsed);
    if(entries.some(e=>e.kind==='ambiguous' || e.kind==='invalid') && !acceptSkipped) throw new HttpError(400,'Review and acknowledge the rows that cannot be imported.');
    state.prospects=applyImport(state.prospects,stage.parsed).prospects;
    return {imported:entries.filter(e=>e.kind==='new' || e.kind==='update').length};
  },stage.revision);
  // A cleanup failure must not report that a committed import failed. Replays
  // remain blocked by the workspace revision; abandoned stages expire.
  try {await removeObject(key(id));} catch {console.error('Committed import stage cleanup failed',id);}
  return result;
}
