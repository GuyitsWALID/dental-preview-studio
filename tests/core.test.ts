import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseWorkbook, applyImport, previewImport, scoreExplanation } from '../lib/prospects';
import { initialWorkspace } from '../lib/seed';
import { createClinicConfig, renderClinicSite, validateSiteConfig, productionIssues, serializeSiteConfig } from '../lib/site/renderer.mjs';
import { releaseManifest, resolvePreview } from '../lib/publication';
import { buildProjectZip, type ExportBundle } from '../lib/export';

const originals=['C:/Users/walid/Downloads/addis_ababa_dental_outreach_ready.xlsx','C:/Users/walid/Downloads/Copy of addis_ababa_dental_outreach_ready.xlsx'];
test('saved configuration comparison ignores JSONB object-key order but preserves real edits and list order',()=>{
  const draft=createClinicConfig({name:'Audit Clinic'});
  draft.phones=['+251911234567','+251922345678'];
  const reordered=JSON.parse(JSON.stringify(draft,(_key,value)=>value && typeof value==='object' && !Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse()):value));
  assert.notEqual(JSON.stringify(draft),JSON.stringify(reordered));
  assert.equal(serializeSiteConfig(draft),serializeSiteConfig(reordered));
  reordered.hero.title='A real copy edit';assert.notEqual(serializeSiteConfig(draft),serializeSiteConfig(reordered));
  reordered.hero.title=draft.hero.title;reordered.phones.reverse();assert.notEqual(serializeSiteConfig(draft),serializeSiteConfig(reordered));
});
test('both supplied workbooks import 49 prospects without duplicates or loss of OLI stage',async t=>{
  let buffers:Buffer[];try{buffers=await Promise.all(originals.map(p=>readFile(p)));}catch{t.skip('Original local workbooks are unavailable on this machine.');return;}
  const first=await parseWorkbook(buffers[0],path.basename(originals[0])),second=await parseWorkbook(buffers[1],path.basename(originals[1]));
  assert.equal(first.sheet,'Outreach Ready');assert.equal(first.rows.length,49);assert.equal(first.rows.filter(r=>r.facts.priority==='High').length,13);
  assert.equal(first.rows.filter(r=>r.facts.email).length,0);assert.equal(first.rows.filter(r=>r.facts.socialNotes).length,2);assert.equal(first.rows.flatMap(r=>r.facts.socialUrls).length,0);
  assert.ok(first.researchDate.includes('2026'));assert.deepEqual(first.rows.map(r=>r.facts),second.rows.map(r=>r.facts));
  const one=applyImport(initialWorkspace().prospects,first).prospects;assert.equal(one.length,49);
  const oli=one.find(p=>p.id==='00000000-0000-4000-8000-000000000001')!;assert.equal(oli.stage,'Proposal requested');assert.equal(oli.source.score,98.8);
  oli.overrides.phone='+251911234567';oli.notes='Manual note';oli.shortlisted=true;
  const imported=applyImport(one,second).prospects;assert.equal(imported.length,49);
  const kept=imported.find(p=>p.id===oli.id)!;assert.equal(kept.overrides.phone,oli.overrides.phone);assert.equal(kept.notes,'Manual note');assert.ok(kept.shortlisted);
  const points=scoreExplanation(kept.source);assert.equal(Object.values(points).reduce((a,b)=>a+b,0),98.8);
  const blank=structuredClone(second);blank.rows.find(r=>r.facts.score===98.8)!.facts.phone='';
  assert.equal(applyImport(imported,blank).prospects.find(p=>p.id===oli.id)!.source.phone,kept.source.phone);
});
test('cached formula values are read, missing values retained, ambiguous identities flagged',async()=>{
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Outreach Ready');sheet.addRow(['Clinic / Practice','Address / Area','Phone','Lead Score']);sheet.addRow(['New Clinic','Bole',null,{formula:'DO_NOT_EXECUTE()',result:88.4}]);
  const parsed=await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()),'sample.xlsx');assert.equal(parsed.rows[0].facts.score,88.4);assert.equal(parsed.rows[0].facts.rating,null);assert.equal(parsed.rows[0].provenance.raw.Phone,null);
  parsed.rows.push(structuredClone(parsed.rows[0]));assert.ok(previewImport([],parsed).every(e=>e.kind==='ambiguous'));
  const seed=initialWorkspace().prospects;const conflict=structuredClone(seed[0]);conflict.id='other';seed.push(conflict);
  const row={facts:structuredClone(seed[0].source),provenance:seed[0].provenance,issues:[]};assert.equal(previewImport(seed,{...parsed,rows:[row]})[0].kind,'ambiguous');
});
test('rendered clinic sites isolate content, validate shape and escape HTML/schema',()=>{
  const oli=initialWorkspace().projects[0].config,fresh=createClinicConfig({name:'Cedar Dental',address:'Bole'});
  const files=renderClinicSite(fresh,{mode:'draft'}),html=files['index.html'];assert.ok(html.includes('Cedar Dental'));assert.ok(!html.includes('OLI'));assert.ok(!html.includes('manus'));assert.ok(!html.includes('aggregateRating'));
  assert.equal(fresh.services.length,0);assert.equal(fresh.reviews.length,0);assert.equal(fresh.heroImage,null);assert.equal(fresh.form.whatsappConfirmed,false);
  assert.notEqual(renderClinicSite(oli,{mode:'draft'})['index.html'],html);
  fresh.hero.body='<script>alert("bad")</script>';fresh.name='Clinic </script><script>bad()</script>';
  const escaped=renderClinicSite(fresh,{mode:'draft'})['index.html'];assert.ok(escaped.includes('&lt;script&gt;'));assert.ok(!escaped.includes('</script><script>bad()'));
  const bad=structuredClone(fresh) as unknown as Record<string,unknown>;bad.privateNotes='private';assert.ok(validateSiteConfig(bad as never).length);
  const url=createClinicConfig();url.socials=[{label:'Bad',url:'javascript:alert(1)'}];assert.ok(validateSiteConfig(url).length);url.socials=[];url.logo={path:'../escape.svg',alt:'bad',width:10,height:10};assert.ok(validateSiteConfig(url).length);
});
test('design controls render consistently and legacy version-one configs remain valid',()=>{
  const legacy=createClinicConfig({name:'Legacy Dental'});delete legacy.appearance;delete legacy.sectionOrder;
  assert.deepEqual(validateSiteConfig(legacy),[]);
  assert.ok(renderClinicSite(legacy,{mode:'draft'})['index.html'].includes('class="hero-split density-comfortable cards-outlined"'));

  const clinic=createClinicConfig({name:'Atlas Dental'});
  clinic.appearance={heroLayout:'centered',density:'compact',corners:'rounded',cards:'elevated'};
  clinic.sectionOrder=['contact','about','services','reviews','faq'];
  clinic.about.body='About Atlas';
  clinic.services=[{id:'cleaning',title:'Cleaning',summary:'A clear summary',body:'Full details',dedicatedPage:false,seoTitle:'',seoDescription:'',faqs:[]}];
  clinic.reviews=[{quote:'A helpful visit',author:'Google reviewer',sourceUrl:'https://www.google.com/maps',checkedAt:'2026-10-15'}];
  clinic.faqs=[{question:'How do I book?',answer:'Contact the clinic.'}];
  const html=renderClinicSite(clinic,{mode:'draft'})['index.html'];
  assert.ok(html.includes('class="hero-centered density-compact cards-elevated"'));
  assert.ok(html.includes('--radius:22px'));
  assert.ok(html.indexOf('id="visit"')<html.indexOf('id="about"'));
  assert.ok(html.indexOf('id="about"')<html.indexOf('id="care"'));
  assert.ok(html.indexOf('id="care"')<html.indexOf('id="reviews"'));

  clinic.sectionOrder=['contact','contact','services','reviews','faq'];
  assert.ok(validateSiteConfig(clinic).length);
});
test('section background colours stay optional, validate as hex and render as CSS variables',()=>{
  const clinic=createClinicConfig({name:'Palette Dental'});
  assert.equal(renderClinicSite(clinic,{mode:'draft'})['index.html'].includes('--bg-body'),false);
  Object.assign(clinic.theme,{bg:'#0b1b2b',headerBg:'#123456',heroBg:'#abcdef',sectionBg:'#f0f0f0',footerBg:'#010203'});
  assert.deepEqual(validateSiteConfig(clinic),[]);
  const html=renderClinicSite(clinic,{mode:'draft'})['index.html'],style=html.slice(html.indexOf('<style>'),html.indexOf('</style>'));
  for(const v of ['--bg-body:#0b1b2b','--bg-header:#123456','--bg-hero:#abcdef','--bg-section:#f0f0f0','--bg-footer:#010203']) assert.ok(style.includes(v),v);
  clinic.theme.bg='navy';assert.ok(validateSiteConfig(clinic).length);
  clinic.theme.bg='';assert.deepEqual(validateSiteConfig(clinic),[]);
  assert.equal(renderClinicSite(clinic,{mode:'draft'})['index.html'].includes('--bg-body'),false);
});
test('production canonicals, sitemap and schema use the final domain; preview stays noindex',()=>{
  const c=createClinicConfig({name:'Cedar Dental',address:'Bole',phone:'+251911234567'});assert.ok(productionIssues(c).length);
  c.seo.siteUrl='https://cedar.example';c.form.whatsappNumber='+251911234567';c.form.whatsappConfirmed=true;c.pages={mode:'multipage',contact:true};c.services=[{id:'cleaning',title:'Dental cleaning',summary:'Clinic-approved summary',body:'Clinic-approved description',dedicatedPage:true,seoTitle:'Cleaning at Cedar',seoDescription:'A distinct description',faqs:[]}];
  const production=renderClinicSite(c,{mode:'production'});assert.ok(production['services/cleaning/index.html'].includes('https://cedar.example/services/cleaning/'));assert.ok(production['sitemap.xml'].includes('https://cedar.example/contact/'));assert.ok(!production['index.html'].includes('noindex'));assert.ok(production['robots.txt'].includes('OAI-SearchBot'));
  const schema=JSON.parse(production['index.html'].match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);assert.equal(schema[0].name,c.name);assert.equal(schema[0].telephone,c.phones[0]);assert.equal(schema[0].address.streetAddress,c.location.address);assert.equal(schema[0].aggregateRating,undefined);
  const preview=renderClinicSite(c,{mode:'preview',basePath:'/preview/cedar/'});assert.ok(preview['index.html'].includes('noindex'));assert.ok(preview['index.html'].includes('/preview/cedar/services/cleaning/'));assert.equal(preview['sitemap.xml'],undefined);assert.ok(preview['index.html'].includes('demo-only'));assert.ok(!preview['index.html'].includes('data-mode="whatsapp"'));
});
test('published pages use immutable assets, block unknown paths and unpublish all releases',()=>{
  const state=initialWorkspace(),p=state.projects[0],old='old-release',current='new-release';p.publishedReleaseId=current;
  state.releases=[old,current].map(id=>({id,projectId:p.id,createdAt:'2026-10-10',published:true,files:{'index.html':{key:id+'/index.html',mime:'text/html'},'styles.css':{key:id+'/styles.css',mime:'text/css'}}}));
  const manifest=releaseManifest(p,current);assert.ok(manifest['index.html'].includes(`/preview/${p.slug}/_releases/${current}/styles.css`));assert.equal(resolvePreview(state,p.slug,[])?.release.id,current);assert.equal(resolvePreview(state,p.slug,['_releases',old,'styles.css'])?.release.id,old);
  assert.equal(resolvePreview(state,p.slug,['not-found']),null);assert.equal(resolvePreview(state,p.slug,['_releases',old,'index.html']),null);assert.equal(resolvePreview(state,p.slug,['..','index.html']),null);
  p.publishedReleaseId=null;assert.equal(resolvePreview(state,p.slug,[]),null);assert.equal(resolvePreview(state,p.slug,['_releases',old,'styles.css']),null);
});
test('ZIP larger than 4.5 MB rebuilds offline with local assets and no private dependencies',async()=>{
  await mkdir('.cache/test-exports',{recursive:true});const dir=await mkdtemp(path.resolve('.cache/test-exports/zip-'));
  const c=createClinicConfig({name:'Portable Dental'});c.heroImage={path:'assets/clinic.webp',width:100,height:100,alt:'Clinic photograph'};
  const sources=Object.fromEntries(await Promise.all(['renderer.mjs','styles.mjs','runtime.mjs'].map(async n=>[n,await readFile('lib/site/'+n,'utf8')])));
  const bytes=randomBytes(2_500_000),bundle:ExportBundle={config:c,slug:'portable',mode:'draft',images:[{path:'assets/clinic.webp',url:'authorized:test'}],fontUrls:[],sources,hasUnpublishedChanges:true};
  const zipBytes=await buildProjectZip(bundle,async()=>bytes);assert.ok(zipBytes.length>4.5*1024*1024);const zip=await JSZip.loadAsync(zipBytes);
  for(const item of Object.values(zip.files)){if(item.dir)continue;const target=path.join(dir,item.name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,await item.async('nodebuffer'));}
  execFileSync(process.execPath,['source/build.mjs'],{cwd:dir,stdio:'pipe'});assert.equal(await readFile(path.join(dir,'site/index.html'),'utf8'),renderClinicSite(c,{mode:'draft',basePath:'/'})['index.html']);assert.deepEqual(await readFile(path.join(dir,'site/assets/clinic.webp')),bytes);
  for(const name of Object.keys(zip.files).filter(n=>/\.(html|js|json|mjs|css)$/.test(n))){const content=await zip.files[name].async('string');assert.ok(!content.includes('manus-storage'));assert.ok(!content.includes('SUPABASE_SECRET_KEY'));assert.ok(!content.includes('/preview/'));}
  c.pages={mode:'multipage',contact:true};await writeFile(path.join(dir,'source/clinic.json'),JSON.stringify(c));execFileSync(process.execPath,['source/build.mjs'],{cwd:dir});assert.ok(await readFile(path.join(dir,'site/contact/index.html'),'utf8'));
  c.pages.mode='landing';await writeFile(path.join(dir,'source/clinic.json'),JSON.stringify(c));execFileSync(process.execPath,['source/build.mjs'],{cwd:dir});await assert.rejects(readFile(path.join(dir,'site/contact/index.html')));
});
test('starter presets prefill valid services, FAQs and theme; unknown presets stay blank',()=>{
  const preset=createClinicConfig({name:'Preset Dental',preset:'ortho'});
  assert.equal(preset.services.length,5);assert.equal(preset.faqs.length,2);assert.equal(preset.theme.primary,'#123C69');
  assert.ok(preset.services.every(s=>s.title && s.summary && s.id));assert.deepEqual(validateSiteConfig(preset),[]);
  const blank=createClinicConfig({name:'Plain Dental',preset:'does-not-exist'});
  assert.equal(blank.services.length,0);assert.equal(blank.faqs.length,0);assert.equal(blank.theme.primary,'#154A52');
});
