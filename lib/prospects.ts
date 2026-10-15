import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { randomUUID, createHash } from 'node:crypto';
import { safeHttps } from './site/renderer.mjs';
import { STAGES, type LeadFacts, type Prospect, type Provenance, type ResearchRecord } from './types';

const columns: Record<string, keyof LeadFacts> = {
  'Clinic / Practice':'name','Address / Area':'address','Phone':'phone','Email':'email',
  'Rating':'rating','Reviews':'reviews','Website Status':'websiteStatus','SEO Presence':'seoPresence',
  'AEO Presence':'aeoPresence','Verification Confidence':'confidence','Evidence / Reason':'evidence',
  'Google Maps':'mapsUrl','Verification Source':'verificationSource','Lead Score':'score','Priority':'priority',
  'Outreach Status':'importedStage','Notes':'notes'
};
export interface ImportedRow { facts: LeadFacts; provenance: Provenance; issues: string[]; research?:Prospect['research'] }
export interface ParsedImport { filename: string; sheet: string; sheets: string[]; columns: string[]; researchDate: string; rows: ImportedRow[]; enrichmentWarnings?:string[]; enrichment?:{clinics:number;reviews:number;assets:number} }
export interface ImportEntry { row: ImportedRow; kind: 'new' | 'update' | 'unchanged' | 'ambiguous' | 'invalid'; matchId?: string; changes: string[]; reason?: string; researchSummary?:{reviews:number;assets:number;coverage:string} }
const norm = (v: string) => v.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
const blank = (v: unknown) => v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length);
export function placeId(url: string) { try { const u=new URL(url); return u.searchParams.get('query_place_id') || u.searchParams.get('place_id') || ''; } catch { return ''; } }
export function identity(f: LeadFacts) { return placeId(f.mapsUrl) || `${norm(f.name)}|${norm(f.address)}`; }
function cellValue(v: ExcelJS.CellValue): string | number | null {
  if (v == null) return null;
  if (typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v) return cellValue(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map(x=>x.text).join('');
    if ('text' in v) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0,10);
    return null;
  }
  return typeof v === 'number' ? v : String(v);
}
const text = (v: unknown) => v == null ? '' : String(v).trim();
const numeric = (v: unknown) => blank(v) || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)*10000)/10000;
function researchTable(workbook:ExcelJS.Workbook,sheetName:string,filename:string):ResearchRecord[] {
  const sheet=workbook.getWorksheet(sheetName);if(!sheet)return [];
  let headerRow=0;const headers:Record<number,string>={};
  sheet.eachRow((row,index)=>{if(!headerRow && text(cellValue(row.getCell(1).value))==='Clinic ID'){headerRow=index;row.eachCell((c,col)=>{headers[col]=text(cellValue(c.value));});}});
  if(!headerRow)return [];
  const records:ResearchRecord[]=[];
  sheet.eachRow((row,index)=>{
    if(index<=headerRow || !text(cellValue(row.getCell(1).value)))return;
    const raw:Provenance['raw']={},values:Provenance['raw']={},links:Record<string,string>={};
    for(const [col,header] of Object.entries(headers)) {
      const cell=row.getCell(Number(col)).value;raw[header]=cellValue(cell);values[header]=raw[header];
      if(cell && typeof cell==='object' && 'hyperlink' in cell && typeof cell.hyperlink==='string' && safeHttps(cell.hyperlink)) {
        links[header]=cell.hyperlink;
        if(/URL|Maps|Source page/i.test(header)) values[header]=cell.hyperlink;
      }
    }
    records.push({values,provenance:{filename:filename.slice(0,180),sheet:sheetName,row:index,researchDate:text(values['Research date'] || values['Collected date']),importedAt:new Date().toISOString(),raw,links}});
  });
  if(records.length>10000)throw new Error('Import up to 10,000 enrichment records per worksheet.');
  return records;
}
function enrichRows(workbook:ExcelJS.Workbook,rows:ImportedRow[],filename:string) {
  const details=researchTable(workbook,'Clinic Details',filename),reviews=researchTable(workbook,'Reviews',filename),assets=researchTable(workbook,'Assets',filename),warnings:string[]=[];
  const linked=new Map<string,ImportedRow>(),outsideSelection=new Map<string,string>();
  for(const detail of details) {
    const v=detail.values,id=text(v['Clinic ID']),pid=placeId(text(v['Original Google Maps'])),name=norm(text(v['Clinic / Practice']));
    const matches=rows.filter(r=>pid?placeId(r.facts.mapsUrl)===pid:norm(r.facts.name)===name);
    if(!id || details.filter(d=>text(d.values['Clinic ID'])===id).length!==1) {warnings.push(`Clinic Details row ${detail.provenance.row}: identity is missing or ambiguous; enrichment was not attached.`);continue;}
    // Filtered outreach sheets can retain research for clinics outside the selected table.
    if(!matches.length) {outsideSelection.set(id,name);continue;}
    if(matches.length!==1 || matches[0].research) {warnings.push(`Clinic Details row ${detail.provenance.row}: identity is missing or ambiguous; enrichment was not attached.`);continue;}
    const row=matches[0];row.research={clinicId:id,details:detail,reviews:[],assets:[]};linked.set(id,row);
  }
  for(const record of reviews) {
    const v=record.values,row=linked.get(text(v['Clinic ID']));
    if(!row && outsideSelection.get(text(v['Clinic ID']))===norm(text(v['Clinic / Practice'])))continue;
    if(!row || norm(text(v['Clinic / Practice']))!==norm(text(row.research!.details.values['Clinic / Practice']))) {warnings.push(`Reviews row ${record.provenance.row}: clinic identity does not match; review was not attached.`);continue;}
    const quote=text(v['Review text — verbatim'] || v['Review text']),summary=text(v['Review summary — paraphrased']),body=quote || summary;
    if(!body)continue;
    const rating=numeric(v['Stars / 5']),sourceUrl=text(v['Review source URL']),issues:string[]=[];
    if(rating!==null && (rating<1 || rating>5 || !Number.isInteger(rating)))issues.push('Invalid individual star rating');
    if(!safeHttps(sourceUrl))issues.push('Missing or invalid HTTPS review source');
    if(/conflict|mismatch|unclear/i.test(text(v['Detail level'])+' '+text(v.Topic)+' '+body))issues.push('Source reports a rating/text conflict; check the original');
    const id=createHash('sha256').update(JSON.stringify([identity(row.facts),text(v['Reviewer display name']),sourceUrl,body])).digest('hex').slice(0,24);
    if(row.research!.reviews.some(r=>r.id===id))continue;
    row.research!.reviews.push({id,text:body,kind:quote?'quote':'summary',author:text(v['Reviewer display name']),rating,dateLabel:text(v['Age shown in snapshot']),platform:text(v['Platform / origin']),sourceUrl,checkedAt:text(v['Collected date']),attribution:text(v.Attribution),topic:text(v.Topic),snapshotContext:text(v['Snapshot context']),rank:numeric(v['Selection rank']),issues,provenance:record.provenance});
  }
  for(const record of assets) {
    const row=linked.get(text(record.values['Clinic ID']));
    if(!row && outsideSelection.get(text(record.values['Clinic ID']))===norm(text(record.values['Clinic / Practice'])))continue;
    if(!row || norm(text(record.values['Clinic / Practice']))!==norm(text(row.research!.details.values['Clinic / Practice']))) {warnings.push(`Assets row ${record.provenance.row}: clinic identity does not match; asset was not attached.`);continue;}
    row.research!.assets.push(record);
  }
  for(const row of rows) row.research?.reviews.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
  return warnings;
}
function researchContent(research:Prospect['research']) {return JSON.stringify(research, (key,value)=>key==='provenance'?undefined:value);}
function mergeResearch(previous:Prospect['research'],incoming:NonNullable<Prospect['research']>) {
  if(!previous)return structuredClone(incoming);
  const merged=structuredClone(incoming);
  merged.details.values={...previous.details.values,...Object.fromEntries(Object.entries(incoming.details.values).filter(([,v])=>!blank(v)))};
  const reviews=new Map(previous.reviews.map(r=>[r.id,r]));
  for(const review of incoming.reviews)reviews.set(review.id,review);
  merged.reviews=[...reviews.values()].sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
  const assetKey=(asset:ResearchRecord)=>JSON.stringify(['Asset type','Asset URL / pointer','Source page','Clinic / branch scope'].map(k=>asset.values[k]));
  const assets=new Map(previous.assets.map(a=>[assetKey(a),a]));
  for(const asset of incoming.assets)assets.set(assetKey(asset),asset);
  merged.assets=[...assets.values()];return merged;
}
export async function parseWorkbook(buffer: ArrayBuffer | Buffer, filename: string, selectedSheet?: string): Promise<ParsedImport> {
  if (!filename.toLowerCase().endsWith('.xlsx')) throw new Error('Choose an .xlsx workbook.');
  if (buffer.byteLength > 2 * 1024 * 1024) throw new Error('Lead workbooks must be smaller than 2 MB.');
  const workbook = new ExcelJS.Workbook();
  // Some valid XLSX producers prefix the spreadsheet namespace (the supplied
  // workbooks use x:). ExcelJS expects unprefixed spreadsheet tags. Normalize
  // only this namespace in a private in-memory copy; never modify the workbook.
  const zip=await JSZip.loadAsync(buffer);
  let expanded=0;
  for (const entry of Object.values(zip.files)) {
    expanded+=Number((entry as unknown as {_data?:{uncompressedSize:number}})._data?.uncompressedSize || 0);
    if (expanded>30*1024*1024) throw new Error('This workbook expands beyond the import limit.');
    // Charts and table presentation are irrelevant to research values; skip
    // their producer-specific relationships rather than interpreting drawings.
    if (/^xl\/(drawings|tables)\//.test(entry.name)) {zip.remove(entry.name);continue;}
    if (!/^xl\/(workbook\.xml|styles\.xml|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(entry.name)) continue;
    let xml=await entry.async('string');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Workbook XML declarations are not supported.');
    const prefixes=[...xml.matchAll(/xmlns:([\w]+)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g)].map(m=>m[1]);
    for (const prefix of new Set(prefixes)) {
      // Only element names change. Research text containing e.g. " x:note"
      // must remain byte-for-byte intact after XML decoding.
      xml=xml.replace(new RegExp(`(<\\/?)${prefix}:`,'g'),'$1');
    }
    if (entry.name.startsWith('xl/worksheets/')) xml=xml.replace(/<drawing\b[^>]*\/>/g,'').replace(/<tableParts\b[^>]*>[\s\S]*?<\/tableParts>/g,'');
    zip.file(entry.name,xml);
  }
  const normalized=await zip.generateAsync({type:'nodebuffer'});
  // Merge ranges are visual formatting and are not part of prospect data. Some
  // research exports contain overlapping ranges that Excel tolerates but
  // ExcelJS rejects, so ignore them while retaining every underlying cell.
  await workbook.xlsx.load(normalized as unknown as Parameters<typeof workbook.xlsx.load>[0],{ignoreNodes:['mergeCells']});
  const sheets = workbook.worksheets.filter(s => s.getRow(1).values && Array.from(s.getRow(1).values as unknown[]).some(v=>text(v)==='Clinic / Practice')).map(s=>s.name);
  const name=selectedSheet || (sheets.includes('Outreach Ready')?'Outreach Ready':sheets.find(s=>s==='Leads') || sheets[0]);
  if (!name || !sheets.includes(name)) throw new Error('No supported clinic table found. The first row must contain Clinic / Practice.');
  const sheet=workbook.getWorksheet(name)!;
  const summary=workbook.getWorksheet('Summary');
  let researchDate='';
  summary?.eachRow(row=>{ if (text(cellValue(row.getCell(1).value))==='Research date') researchDate=text(cellValue(row.getCell(2).value)); });
  const headers: Record<number,string>={};
  sheet.getRow(1).eachCell((cell,col)=>{headers[col]=text(cellValue(cell.value));});
  const rows: ImportedRow[]=[];
  sheet.eachRow((row,index)=>{
    if (index===1) return;
    const raw: Record<string,string|number|null>={},links:Record<string,string>={};
    for (const [col,header] of Object.entries(headers)) {
      const value=row.getCell(Number(col)).value;
      raw[header]=cellValue(value);
      if(value && typeof value==='object' && 'hyperlink' in value && typeof value.hyperlink==='string' && safeHttps(value.hyperlink)) links[header]=value.hyperlink;
    }
    if (!Object.values(raw).some(v=>!blank(v))) return;
    const facts: LeadFacts={name:'',address:'',phone:'',email:'',socialNotes:'',socialUrls:[],rating:null,reviews:null,websiteStatus:'',seoPresence:'',aeoPresence:'',confidence:'',evidence:'',mapsUrl:'',verificationSource:'',score:null,priority:'',importedStage:'',notes:''};
    for (const [header,key] of Object.entries(columns)) {
      if (['rating','reviews','score'].includes(key)) (facts as unknown as Record<string,unknown>)[key]=numeric(raw[header]);
      else (facts as unknown as Record<string,unknown>)[key]=text(['mapsUrl','verificationSource'].includes(key)?links[header] || raw[header]:raw[header]);
    }
    const social=text(raw['Social Media']);
    const urls=[...new Set([...(links['Social Media']?[links['Social Media']]:[]),...social.split(/[\s,;]+/).filter(v=>safeHttps(v))])];
    facts.socialUrls=urls; facts.socialNotes=urls.length?social.split(/[\s,;]+/).filter(v=>!safeHttps(v)).join(' '):social;
    const issues=[];
    if (!facts.name) issues.push('Missing clinic name');
    if (facts.rating!=null && (facts.rating<0 || facts.rating>5)) issues.push('Rating must be between 0 and 5');
    if (facts.reviews!=null && (facts.reviews<0 || !Number.isInteger(facts.reviews))) issues.push('Invalid review count');
    rows.push({facts,provenance:{filename:filename.slice(0,180),sheet:name,row:index,researchDate,importedAt:new Date().toISOString(),raw,links},issues});
  });
  if (rows.length>2000) throw new Error('Import up to 2,000 prospects at a time.');
  const enrichmentWarnings=enrichRows(workbook,rows,filename);
  const enriched=rows.filter(r=>r.research),enrichment={clinics:enriched.length,reviews:enriched.reduce((n,r)=>n+r.research!.reviews.length,0),assets:enriched.reduce((n,r)=>n+r.research!.assets.length,0)};
  return {filename,sheet:name,sheets,columns:Object.values(headers),researchDate,rows,...(enriched.length?{enrichment}:{}),...(enrichmentWarnings.length?{enrichmentWarnings}:{})};
}
export function previewImport(existing: Prospect[], parsed: ParsedImport): ImportEntry[] {
  const rowKeys=parsed.rows.map(r=>identity(r.facts));
  const fallbackKeys=parsed.rows.map(r=>`${norm(r.facts.name)}|${norm(r.facts.address)}`);
  return parsed.rows.map((row,i)=>{
    if (row.issues.length) return {row,kind:'invalid',changes:[],reason:row.issues.join(', ')};
    const f=row.facts, pid=placeId(f.mapsUrl);
    if (fallbackKeys.some((key,j)=>j!==i && key===fallbackKeys[i] && rowKeys[j]!==rowKeys[i])) return {row,kind:'ambiguous',changes:[],reason:'Same name/address has conflicting identities in this workbook.'};
    if (rowKeys.indexOf(rowKeys[i])!==i || rowKeys.lastIndexOf(rowKeys[i])!==i) return {row,kind:'ambiguous',changes:[],reason:'Duplicate clinic identity in this workbook. Resolve before import.'};
    let matches=pid?existing.filter(p=>placeId(p.source.mapsUrl)===pid):[];
    if (!matches.length) {
      matches=existing.filter(p=>norm(p.source.name)===norm(f.name) && norm(p.source.address)===norm(f.address));
      if (pid && matches.some(p=>placeId(p.source.mapsUrl) && placeId(p.source.mapsUrl)!==pid)) return {row,kind:'ambiguous',changes:[],reason:'Same name/address but conflicting Google place IDs.'};
    }
    if (matches.length>1) return {row,kind:'ambiguous',changes:[],reason:'Multiple existing clinics match. Resolve before import.'};
    if (!matches.length) return {row,kind:'new',changes:[]};
    const match=matches[0];
    const changes=Object.keys(f).filter(k=>!blank(f[k as keyof LeadFacts]) && JSON.stringify(f[k as keyof LeadFacts])!==JSON.stringify(match.source[k as keyof LeadFacts]));
    if(row.research && researchContent(mergeResearch(match.research,row.research))!==researchContent(match.research)) changes.push('research');
    return {row,kind:changes.length?'update':'unchanged',matchId:match.id,changes};
  });
}
export function applyImport(existing: Prospect[], parsed: ParsedImport) {
  const result=structuredClone(existing), entries=previewImport(result,parsed);
  for (const entry of entries) {
    if (entry.kind==='ambiguous' || entry.kind==='invalid') continue;
    if (entry.matchId) {
      const p=result.find(p=>p.id===entry.matchId)!;
      for (const [key,value] of Object.entries(entry.row.facts)) if (!blank(value)) (p.source as unknown as Record<string,unknown>)[key]=value;
      p.provenance=entry.row.provenance;
      if(entry.row.research)p.research=mergeResearch(p.research,entry.row.research);
    } else {
      const f=entry.row.facts;
      entry.matchId=randomUUID();
      result.push({id:entry.matchId,source:f,provenance:entry.row.provenance,overrides:{},notes:f.notes,shortlisted:false,stage:STAGES.includes(f.importedStage as typeof STAGES[number])?f.importedStage as typeof STAGES[number]:'Not contacted',recheck:{status:'Not rechecked',url:'',checkedAt:''},...(entry.row.research?{research:entry.row.research}:{})});
    }
  }
  return {prospects:result,entries};
}
export function scoreExplanation(f: LeadFacts) {
  return {base:40,phone:f.phone?20:0,reviews:f.reviews==null?0:Math.min(f.reviews/50*20,20),rating:f.rating==null?0:f.rating>=4.5?20:f.rating>=4?10:0};
}
