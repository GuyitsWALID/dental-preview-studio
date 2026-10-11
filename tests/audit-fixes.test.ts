import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseWorkbook, previewImport } from '../lib/prospects';
import { createClinicConfig, renderClinicSite, validPhone, validateSiteConfig, productionIssues } from '../lib/site/renderer.mjs';
import { storeRelease } from '../lib/publication';

test('phone destinations require an explicit international prefix and never guess a country',()=>{
  for(const phone of ['0911234567','+0911234567','251911234567','+1','+1234567890123456','+251/911234567']) assert.equal(validPhone(phone),false,phone);
  for(const phone of ['+251911234567','+251 (911) 234-567','+1 415 555 0123']) assert.equal(validPhone(phone),true,phone);
  const c=createClinicConfig();c.seo.siteUrl='https://clinic.example';c.form.whatsappConfirmed=true;
  for(const phone of ['0911234567','+0911234567']) {
    c.phones=[phone];c.form.whatsappNumber=phone;
    assert.ok(validateSiteConfig(c).length);assert.ok(productionIssues(c).length);
    assert.throws(()=>renderClinicSite(c,{mode:'production'}));
  }
});
test('hyperlink targets survive while source labels, missing values and cached results remain intact',async()=>{
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Outreach Ready');
  sheet.addRow(['Clinic / Practice','Address / Area','Google Maps','Social Media','Verification Source','Email','Lead Score']);
  const maps='https://www.google.com/maps/search/?api=1&query_place_id=verified-place';
  sheet.addRow(['Linked Clinic','Bole',{text:'Open map',hyperlink:maps},{text:'Facebook profile',hyperlink:'https://facebook.com/linkedclinic'},{text:'Evidence',hyperlink:'https://clinic.example/evidence'},null,{formula:'DO_NOT_EXECUTE()',result:90}]);
  sheet.addRow(['Unsafe link','Bole',{text:'Map label',hyperlink:'javascript:bad()'},null,null,null,null]);
  const parsed=await parseWorkbook(Buffer.from(await book.xlsx.writeBuffer()),'links.xlsx'),row=parsed.rows[0];
  assert.equal(row.facts.mapsUrl,maps);assert.equal(row.facts.verificationSource,'https://clinic.example/evidence');
  assert.deepEqual(row.facts.socialUrls,['https://facebook.com/linkedclinic']);assert.equal(row.facts.socialNotes,'Facebook profile');
  assert.equal(row.provenance.raw['Google Maps'],'Open map');assert.equal(row.provenance.links?.['Google Maps'],maps);
  assert.equal(row.provenance.raw.Email,null);assert.equal(row.facts.email,'');assert.equal(row.facts.score,90);
  assert.equal(parsed.rows[1].provenance.links?.['Google Maps'],undefined);
  const imported={id:'linked',source:{...row.facts,name:'Renamed clinic'},provenance:row.provenance,overrides:{},notes:'',stage:'Not contacted' as const,shortlisted:false,recheck:{status:'Not rechecked',url:'',checkedAt:''}};
  assert.equal(previewImport([imported],parsed)[0].matchId,'linked');
});
test('hidden contact destinations are omitted on landing and service pages; dedicated contact remains linked',()=>{
  const c=createClinicConfig({name:'Contact test'});c.sections.contact=false;c.about.body='About this clinic';
  c.services=[{id:'care',title:'Care',summary:'Summary',body:'Body',dedicatedPage:true,seoTitle:'',seoDescription:'',faqs:[]}];
  for(const mode of ['landing','multipage'] as const) {
    c.pages={mode,contact:false};
    for(const html of Object.values(renderClinicSite(c,{mode:'preview',basePath:'/preview/contact-test/'})).filter(x=>x.includes('<html'))) {
      assert.ok(!html.includes('href="/preview/contact-test/#visit"'));assert.ok(!html.includes('href=""'));
    }
  }
  c.pages.contact=true;
  const files=renderClinicSite(c,{mode:'preview',basePath:'/preview/contact-test/'});
  assert.ok(files['index.html'].includes('href="/preview/contact-test/contact/"'));assert.ok(files['contact/index.html'].includes('id="visit"'));
});
test('blank social rows never enter structured data and visible profiles match sameAs',()=>{
  const c=createClinicConfig();c.socials=[{label:'',url:''},{label:'Facebook',url:'https://facebook.com/clinic'}];
  const html=renderClinicSite(c,{mode:'draft'})['index.html'];
  const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])[0];
  assert.deepEqual(schema.sameAs,['https://facebook.com/clinic']);assert.ok(html.includes('href="https://facebook.com/clinic"'));
  c.socials=[{label:'',url:''}];const empty=renderClinicSite(c,{mode:'draft'})['index.html'];
  assert.equal(JSON.parse(empty.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])[0].sameAs,undefined);
});
test('failed publication waits for slow writes and removes every attempted object before returning',async()=>{
  const stored=new Set(['previous-release']),events:string[]=[];
  const files=['fast','failed','slow'].map(key=>({key,bytes:new Uint8Array(),mime:'text/plain'}));
  let commitCalled=false;
  await assert.rejects(storeRelease(files,async key=>{
    if(key==='slow')await new Promise(r=>setTimeout(r,30));
    stored.add(key);events.push('put:'+key);
    if(key==='failed')throw new Error('Injected upload failure');
  },async key=>{events.push('remove:'+key);stored.delete(key);},async()=>{commitCalled=true;}),/Injected upload failure/);
  assert.equal(commitCalled,false);assert.deepEqual([...stored],['previous-release']);assert.ok(events.indexOf('remove:slow')>events.indexOf('put:slow'));
});
test('commit conflicts roll back only the new release; successful publication keeps its files',async()=>{
  const files=[{key:'new',bytes:new Uint8Array(),mime:'text/plain'}],stored=new Set(['old']);
  const put=async(key:string)=>{stored.add(key);},remove=async(key:string)=>{stored.delete(key);};
  await assert.rejects(storeRelease(files,put,remove,async()=>{throw new Error('Draft changed');}),/Draft changed/);
  assert.deepEqual([...stored],['old']);assert.equal(await storeRelease(files,put,remove,async()=>'/preview/clinic/'),'/preview/clinic/');assert.deepEqual([...stored],['old','new']);
});
