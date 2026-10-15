import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { parseWorkbook, applyImport, previewImport } from '../lib/prospects';
import { initialWorkspace } from '../lib/seed';
import { createClinicConfig, renderClinicSite, validateSiteConfig } from '../lib/site/renderer.mjs';

test('website-checked workbook imports its current outreach set, retains history and surfaces real enrichment conflicts',async t=>{
  let bytes:Buffer,previous:Buffer;
  try {bytes=await readFile('C:/Users/walid/Downloads/addis_ababa_dental_no_website_checked.xlsx');previous=await readFile('C:/Users/walid/Downloads/addis_ababa_dental_outreach_ready (1).xlsx');}
  catch{t.skip('Local checked workbooks unavailable.');return;}
  const parsed=await parseWorkbook(bytes,'checked.xlsx');
  assert.equal(parsed.sheet,'Outreach Ready');assert.equal(parsed.rows.length,28);assert.equal(parsed.rows.filter(r=>r.facts.priority==='High').length,7);
  assert.deepEqual(parsed.enrichment,{clinics:28,reviews:26,assets:6});assert.equal(parsed.enrichmentWarnings?.length,6);
  assert.ok(parsed.rows.every(r=>r.facts.websiteStatus.includes('No owned website found')));
  assert.equal((await parseWorkbook(bytes,'checked.xlsx','Leads')).rows.length,34);
  const workspace=initialWorkspace();workspace.prospects=applyImport(workspace.prospects,await parseWorkbook(previous,'previous.xlsx')).prospects;
  const oli=workspace.prospects.find(p=>p.stage==='Proposal requested')!;oli.notes='Keep this conversation';oli.shortlisted=true;oli.overrides={name:'Owner-approved OLI'};
  const before=structuredClone(workspace.prospects),projects=JSON.stringify(workspace.projects),imported=applyImport(before,parsed);
  assert.equal(imported.prospects.length,49);assert.ok(imported.entries.every(e=>e.kind==='update' && e.matchId));
  const currentIds=new Set(imported.entries.map(e=>e.matchId));assert.equal(currentIds.size,28);
  const outside=imported.prospects.filter(p=>!currentIds.has(p.id));assert.equal(outside.length,21);
  for(const p of outside)assert.deepEqual(p,before.find(old=>old.id===p.id));
  const saved=imported.prospects.find(p=>p.id===oli.id)!;assert.equal(saved.stage,'Proposal requested');assert.equal(saved.notes,oli.notes);assert.equal(saved.shortlisted,true);assert.deepEqual(saved.overrides,oli.overrides);
  assert.equal(JSON.stringify(workspace.projects),projects);assert.ok(previewImport(imported.prospects,parsed).every(e=>e.kind==='unchanged'));
  const fresh=applyImport([],parsed);assert.equal(fresh.prospects.length,28);assert.ok(fresh.entries.every(e=>fresh.prospects.some(p=>p.id===e.matchId)));
});

test('upgraded workbook links 49 clinics and 27 paraphrases without inventing OLI reviews or leaking between clinics',async t=>{
  let bytes:Buffer;try {bytes=await readFile('C:/Users/walid/Downloads/addis_ababa_dental_outreach_ready (1).xlsx');}catch{t.skip('Upgraded local workbook unavailable.');return;}
  const parsed=await parseWorkbook(bytes,'upgraded.xlsx');assert.equal(parsed.rows.length,49);assert.equal(parsed.enrichment?.clinics,49);assert.equal(parsed.enrichment?.reviews,27);assert.equal(parsed.enrichmentWarnings,undefined);
  const groups=Object.fromEntries(parsed.rows.filter(r=>r.research?.reviews.length).map(r=>[r.research!.clinicId,r.research!.reviews.length]));assert.deepEqual(groups,{'DENT-005':9,'DENT-015':10,'DENT-039':8});
  const oli=parsed.rows.find(r=>r.research?.clinicId==='DENT-003')!;assert.equal(oli.research!.reviews.length,0);assert.equal(oli.research!.details.provenance.sheet,'Clinic Details');
  const all=parsed.rows.flatMap(r=>r.research?.reviews || []);assert.ok(all.every(r=>r.kind==='summary'));assert.ok(all.every(r=>r.checkedAt==='2026-10-11' && r.sourceUrl.startsWith('https:')));assert.ok(all.some(r=>r.rating===1 && r.issues.length));
  const workspace=initialWorkspace(),config=JSON.stringify(workspace.projects[0].config);workspace.prospects=applyImport(workspace.prospects,parsed).prospects;assert.equal(workspace.prospects.length,49);assert.equal(workspace.prospects.find(p=>p.id.endsWith('001'))!.stage,'Proposal requested');assert.equal(JSON.stringify(workspace.projects[0].config),config);
  const again=await parseWorkbook(bytes,'another-copy.xlsx');assert.ok(previewImport(workspace.prospects,again).every(e=>e.kind==='unchanged'));
  const updated=applyImport(workspace.prospects,again).prospects;assert.equal(updated.flatMap(p=>p.research?.reviews || []).length,27);
  const empty=structuredClone(again);for(const row of empty.rows)row.research!.reviews=[];
  assert.equal(applyImport(updated,empty).prospects.flatMap(p=>p.research?.reviews || []).length,27);
});
test('enrichment rejects cross-clinic IDs and ambiguous matches, and reads cached review formulas without executing',async()=>{
  const wb=new ExcelJS.Workbook(),leads=wb.addWorksheet('Outreach Ready'),details=wb.addWorksheet('Clinic Details'),reviews=wb.addWorksheet('Reviews');
  leads.addRow(['Clinic / Practice','Address / Area','Google Maps']);leads.addRow(['Clinic A','Bole','https://google.com/maps?query_place_id=clinic-a']);leads.addRow(['Clinic B','Bole','https://google.com/maps?query_place_id=clinic-b']);
  details.addRow(['Enriched workbook']);details.addRow(['Clinic ID','Clinic / Practice','Original Google Maps','Research date']);details.addRow(['DENT-001','Clinic A','https://google.com/maps?query_place_id=clinic-a','2026-10-11']);details.addRow(['DENT-002','Clinic B','https://google.com/maps?query_place_id=clinic-b','2026-10-11']);
  reviews.addRow(['Clinic ID','Clinic / Practice','Reviewer display name','Review summary — paraphrased','Review source URL','Stars / 5']);
  reviews.addRow(['DENT-001','Clinic B','Wrong branch','Do not attach','https://example.test',5]);reviews.addRow(['DENT-002','Clinic B','Correct reviewer',{formula:'DONT_EXECUTE()',result:'A cached summary'},'https://example.test',4]);
  const parsed=await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()),'mixed.xlsx');assert.equal(parsed.rows[0].research!.reviews.length,0);assert.equal(parsed.rows[1].research!.reviews[0].text,'A cached summary');assert.equal(parsed.enrichmentWarnings?.length,1);
  leads.addRow(['Clinic A','Another location','https://google.com/maps?query_place_id=clinic-a']);const ambiguous=await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()),'ambiguous.xlsx');assert.ok(!ambiguous.rows[0].research);assert.ok(ambiguous.enrichmentWarnings!.length>=1);
  leads.spliceRows(2,1);leads.spliceRows(3,1);
  const filtered=await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()),'filtered.xlsx');
  assert.equal(filtered.rows.length,1);assert.equal(filtered.enrichmentWarnings?.length,1);assert.ok(filtered.enrichmentWarnings![0].startsWith('Reviews row 2:'));
});
test('review summaries retain attribution and actual stars in HTML, with backwards-compatible public config',()=>{
  const c=createClinicConfig({name:'Review clinic'});c.reviews=[{quote:'A supplied paraphrase <script>bad()</script>',author:'Reviewer',sourceUrl:'https://example.test/reviews',checkedAt:'2026-10-11',kind:'summary',rating:1,dateLabel:'2 years ago',platform:'Mirrored Google review',snapshotContext:'Older snapshot',attribution:'Paraphrased'}];
  assert.deepEqual(validateSiteConfig(c),[]);const html=renderClinicSite(c,{mode:'draft'})['index.html'];assert.ok(html.includes('Paraphrased review summary'));assert.ok(html.includes('aria-label="1 out of 5 stars"'));assert.ok(html.includes('Age shown at source snapshot: 2 years ago'));assert.ok(!html.includes('<blockquote'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('aggregateRating'));assert.ok(html.includes('data-review-next'));
  c.reviews[0].rating=6;assert.ok(validateSiteConfig(c).length);c.reviews=[{quote:'Existing exact excerpt',author:'Original reviewer',sourceUrl:'',checkedAt:''}];assert.deepEqual(validateSiteConfig(c),[]);assert.ok(!renderClinicSite(c,{mode:'draft'})['index.html'].includes('aria-label="5 out of 5 stars"'));
  (c.reviews[0] as unknown as Record<string,unknown>).privateNotes='secret';assert.ok(validateSiteConfig(c).length);
});
