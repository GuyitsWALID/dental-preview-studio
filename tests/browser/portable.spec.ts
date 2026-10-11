import { test, expect } from './fixtures';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import JSZip from 'jszip';
import sharp from 'sharp';
import { createClinicConfig } from '../../lib/site/renderer.mjs';

test('large browser download rebuilds and navigates on an ordinary static host',async({page,context,request})=>{
  test.setTimeout(180000);
  await context.route('https://**/*',route=>route.fulfill({body:'Mock external connection'}));
  const post=(body:unknown)=>request.post('/api/studio',{headers:{Origin:process.env.STUDIO_TEST_ORIGIN!},data:body});
  let w=await (await request.get('/api/studio')).json();if(w.state.prospects.length<2){const imported=await request.post('/api/import',{headers:{Origin:process.env.STUDIO_TEST_ORIGIN!},multipart:{file:{name:'leads.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await readFile('C:/Users/walid/Downloads/addis_ababa_dental_outreach_ready.xlsx')}}});const payload=await imported.json();expect(imported.status()).toBe(200);expect((await post({action:'confirmImport',importId:payload.importId,revision:payload.revision})).status()).toBe(200);w=await (await request.get('/api/studio')).json();}const prospect=w.state.prospects.find((p:any)=>p.id!=='00000000-0000-4000-8000-000000000001');expect(prospect).toBeTruthy();
  const created=await (await post({action:'createProject',prospectId:prospect.id,revision:w.revision})).json();
  const assets=[];for(let i=0;i<3;i++){
    const buffer=await sharp(randomBytes(1600*1600*3),{raw:{width:1600,height:1600,channels:3}}).jpeg({quality:95}).toBuffer();
    const uploaded=await request.post('/api/upload',{headers:{Origin:process.env.STUDIO_TEST_ORIGIN!},multipart:{file:{name:`photo-${i}.jpg`,mimeType:'image/jpeg',buffer}}});expect(uploaded.status()).toBe(200);assets.push((await uploaded.json()).asset);
  }
  w=await (await request.get('/api/studio')).json();const project=w.state.projects.find((p:any)=>p.id===created.id),config=createClinicConfig({name:'Portable Test Dental',address:'Verified test location'});
  [config.logo,config.heroImage,config.coverImage]=assets.map(a=>({path:a.path,alt:'Test image',width:a.width,height:a.height}));config.about.body='Clinic-approved example text';config.pages={mode:'multipage',contact:true};config.services=[{id:'cleaning',title:'Dental cleaning',summary:'A clinic-approved summary.',body:'A distinct service description.',dedicatedPage:true,seoTitle:'Cleaning at Portable Test Dental',seoDescription:'Clinic-approved cleaning information.',faqs:[]}];
  expect((await post({action:'saveProject',id:project.id,config,slug:project.slug,revision:w.revision})).status()).toBe(200);
  expect((await post({action:'publish',projectId:project.id})).status()).toBe(200);
  await page.goto(`/preview/${project.slug}/`);await page.getByRole('link',{name:'Explore this service'}).click();await expect(page).toHaveURL(new RegExp(`/preview/${project.slug}/services/cleaning/?$`));await page.getByRole('link',{name:'Contact',exact:true}).first().click();await expect(page).toHaveURL(new RegExp(`/preview/${project.slug}/contact/?$`));expect((await request.get(`/preview/${project.slug}/contact/`)).headers()['x-robots-tag']).toContain('noindex');
  await page.goto('/');await page.getByRole('button',{name:'Clinic projects',exact:false}).first().click();const card=page.locator('.project-card').filter({hasText:'Portable Test Dental'});await card.getByRole('button',{name:'Edit website'}).click();await page.getByRole('button',{name:'Export ZIP',exact:true}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download ZIP',exact:true}).click();const downloaded=await downloading,downloadPath=await downloaded.path();expect(downloadPath).toBeTruthy();const zipBytes=await readFile(downloadPath!);expect(zipBytes.length).toBeGreaterThan(4.5*1024*1024);
  await mkdir('.cache/browser-exports',{recursive:true});const dir=await mkdtemp(path.resolve('.cache/browser-exports/export-')),zip=await JSZip.loadAsync(zipBytes);
  for(const entry of Object.values(zip.files)){if(entry.dir)continue;const target=path.join(dir,entry.name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,await entry.async('nodebuffer'));}
  execFileSync(process.execPath,['source/build.mjs'],{cwd:dir});
  // The exported browser is deliberately denied access to the studio.
  await context.route(process.env.STUDIO_TEST_ORIGIN!+'/**',route=>route.abort());const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const server=createServer(async(req,res)=>{const pathname=new URL(req.url!,'http://localhost').pathname;let rel=decodeURIComponent(pathname).replace(/^\//,'');if(!rel || rel.endsWith('/'))rel+='index.html';if(rel.split('/').includes('..')){res.writeHead(404).end();return;}try{const bytes=await readFile(path.join(dir,'site',rel));res.setHeader('Content-Type',rel.endsWith('.html')?'text/html':rel.endsWith('.css')?'text/css':rel.endsWith('.js')?'text/javascript':rel.endsWith('.webp')?'image/webp':rel.endsWith('.woff2')?'font/woff2':'image/svg+xml');res.end(bytes);}catch{res.writeHead(404).end();}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;
  try {
    await page.goto(`http://127.0.0.1:${port}/`);await expect(page.getByRole('heading',{name:'Welcome to Portable Test Dental'})).toBeVisible();await page.getByRole('link',{name:'Explore this service'}).click();await expect(page).toHaveURL(/\/services\/cleaning\/$/);await expect(page.getByRole('heading',{name:'Dental cleaning',exact:true})).toBeVisible();await page.getByRole('link',{name:'Contact',exact:true}).first().click();await expect(page).toHaveURL(/\/contact\/$/);await expect(page.getByText('Demo form only.',{exact:false})).toBeVisible();
    const images=await page.locator('img').evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth>0));expect(images).toBe(true);
    await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeVisible();await page.getByRole('button',{name:'Menu',exact:true}).click();await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Home',exact:true}).focus();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Menu',exact:true})).toHaveAttribute('aria-expanded','false');await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.cache/export-mobile.png',fullPage:true});expect(errors).toEqual([]);
  } finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
