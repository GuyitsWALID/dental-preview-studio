import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { createClinicConfig, renderClinicSite } from '../../lib/site/renderer.mjs';

test('enriched import exposes review candidates, adds only selected summaries and exports attributed public content',async({page,context,request})=>{
  await context.route('https://**/*',route=>route.fulfill({body:'External connection mocked'}));
  await page.goto('/');await page.getByRole('button',{name:'Import spreadsheet'}).click();
  await page.locator('input[type=file]').setInputFiles('C:/Users/walid/Downloads/addis_ababa_dental_outreach_ready (1).xlsx');
  await expect(page.getByText('Enriched research: 49 clinics, 27 review records', {exact:false})).toBeVisible();await page.getByRole('button',{name:'Confirm import'}).click();await expect(page.getByText('49 of 49 prospects')).toBeVisible();
  await page.getByLabel('Search prospects').fill('Green Life');await page.getByRole('button',{name:'Open Green Life Specialty Dental Clinic',exact:true}).click();
  await expect(page.getByText('9 collected review records', {exact:false})).toBeVisible();await page.getByRole('button',{name:'Open clinic project'}).click();
  await page.getByRole('tab',{name:'Care',exact:true}).click();await page.getByText('Choose from imported clinic research',{exact:true}).click();
  const candidate=page.getByLabel('Select review by Thomas Gryczka (.');await expect(candidate).toBeVisible();await candidate.check();
  const add=page.getByRole('button',{name:'Add 1 reviews to draft'});await expect(add).toBeDisabled();await page.getByLabel('I checked the selected reviews, clinic identity and source attribution for this website').check();await add.click();
  await expect(page.getByRole('textbox',{name:'Review summary',exact:true})).toHaveValue(/Reports successful Invisalign/);
  const save=page.waitForResponse(r=>r.request().method()==='POST' && r.request().postDataJSON()?.action==='saveProject');await page.getByRole('button',{name:'Save draft',exact:true}).click();expect((await save).status()).toBe(200);await expect(page.getByRole('button',{name:'Publish preview',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Publish preview',exact:true}).click();await expect(page.getByRole('link',{name:'Open preview',exact:true})).toBeVisible();const previewPath=await page.getByRole('link',{name:'Open preview',exact:true}).getAttribute('href');
  const html=await (await request.get(previewPath!)).text();expect(html).toContain('Paraphrased review summary');expect(html).toContain('Age shown at source snapshot: 2 years ago');expect(html).not.toContain('DENT-005');expect(html).not.toContain('Research notes');expect(html).not.toContain('aggregateRating');
  await page.getByRole('button',{name:'Export ZIP',exact:true}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download ZIP',exact:true}).click();const zip=await JSZip.loadAsync(await readFile((await (await downloading).path())!));
  const config=JSON.parse(await zip.file('source/clinic.json')!.async('string'));expect(config.reviews).toHaveLength(1);expect(config.reviews[0].kind).toBe('summary');expect(config.reviews[0].rating).toBe(5);expect(config.research).toBeUndefined();expect(await zip.file('site/index.html')!.async('string')).toContain('Paraphrased review summary');
});

test('review carousel loops without a visible reset, pauses for controls/focus and respects reduced motion',async({page})=>{
  const config=createClinicConfig({name:'Carousel Test'});config.reviews=Array.from({length:4},(_,i)=>({quote:`Collected summary ${i}`,author:`Reviewer ${i}`,sourceUrl:'https://source.example/reviews',checkedAt:'2026-10-11',kind:'summary' as const,rating:i+1}));
  const files=renderClinicSite(config,{mode:'draft'});
  await page.route('https://carousel.example/**',async route=>{
    const key=new URL(route.request().url()).pathname.slice(1)||'index.html';
    if(key.endsWith('.woff2'))return route.fulfill({body:await readFile('public/studio-fonts/'+key.split('/').at(-1)),contentType:'font/woff2'});
    return route.fulfill({body:files[key] || '',contentType:key.endsWith('.js')?'text/javascript':key.endsWith('.css')?'text/css':'text/html'});
  });
  await page.setViewportSize({width:390,height:844});await page.goto('https://carousel.example/');const track=page.locator('[data-reviews]'),pause=page.getByRole('button',{name:'Pause reviews'});
  await track.scrollIntoViewIfNeeded();await expect.poll(()=>track.evaluate(el=>el.scrollLeft)).toBeGreaterThan(5);expect(await page.locator('[data-review-copy]').count()).toBe(4);expect(await page.locator('[data-review-copy]').evaluateAll(nodes=>nodes.every(n=>(n as HTMLElement).inert && n.getAttribute('aria-hidden')==='true'))).toBe(true);
  await pause.click();await expect(page.getByRole('button',{name:'Resume reviews'})).toHaveAttribute('aria-pressed','true');
  // Put the paused track just before its seam, then resume. The matching
  // first card follows the last; animation wraps before reaching the end.
  await track.evaluate(el=>{const first=el.firstElementChild!,copy=el.querySelector('[data-review-copy]')!;el.scrollLeft=copy.getBoundingClientRect().left-first.getBoundingClientRect().left-2;});
  await page.getByRole('button',{name:'Resume reviews'}).click();await expect.poll(()=>track.evaluate(el=>el.scrollLeft)).toBeLessThan(100);
  await page.getByRole('button',{name:'Next review',exact:true}).click();await expect(page.getByRole('button',{name:'Resume reviews'})).toBeVisible();await expect.poll(()=>track.evaluate(el=>el.scrollLeft)).toBeGreaterThan(300);
  await track.focus();await page.keyboard.press('ArrowLeft');await expect.poll(()=>track.evaluate(el=>el.scrollLeft)).toBeLessThan(100);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('[data-pause]')).toBeHidden();expect(await page.locator('[data-review-copy]').evaluateAll(nodes=>nodes.every(n=>(n as HTMLElement).hidden))).toBe(true);await expect(page.getByRole('button',{name:'Next review',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Next review',exact:true}).click();await expect.poll(()=>track.evaluate(el=>el.scrollLeft)).toBeGreaterThan(300);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.cache/reviews-mobile.png',fullPage:true});
});
