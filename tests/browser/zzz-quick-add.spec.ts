import { test, expect } from './fixtures';

test('Google Maps quick add validates input, preserves existing research and can open a new project',async({page,request})=>{
  const headers={Origin:process.env.STUDIO_TEST_ORIGIN!};
  let workspace=await (await request.get('/api/studio')).json();
  const invalid=await request.post('/api/studio',{headers,data:{action:'addMapsProspect',revision:workspace.revision,facts:{name:'Unsafe Clinic',mapsUrl:'https://evil.example/maps'}}});
  expect(invalid.status()).toBe(400);

  const mapsUrl='https://www.google.com/maps/search/?api=1&query=Workflow+Dental&query_place_id=workflow-place-1';
  const added=await request.post('/api/studio',{headers,data:{action:'addMapsProspect',revision:workspace.revision,facts:{name:'Workflow Dental',mapsUrl,address:'Bole',phone:'+251911234567',rating:4.8,reviews:42,evidence:'Checked manually.'}}});
  expect(added.status(),await added.text()).toBe(200);const first=await added.json();
  workspace=await (await request.get('/api/studio')).json();
  const duplicate=await request.post('/api/studio',{headers,data:{action:'addMapsProspect',revision:workspace.revision,facts:{name:'Overwrite attempt',mapsUrl:'https://maps.google.com/?query_place_id=workflow-place-1',address:'Wrong address'}}});
  expect(duplicate.status(),await duplicate.text()).toBe(200);expect((await duplicate.json()).id).toBe(first.id);
  workspace=await (await request.get('/api/studio')).json();
  const saved=workspace.state.prospects.find((prospect:any)=>prospect.id===first.id);expect(saved.source.name).toBe('Workflow Dental');expect(saved.source.address).toBe('Bole');
  if(workspace.state.outreachList)expect(workspace.state.outreachList.prospectIds).toContain(first.id);

  await page.goto('/');await page.getByRole('button',{name:'From Google Maps',exact:true}).click();
  await page.getByLabel('Google Maps place URL').fill('https://maps.google.com/?cid=987654321');
  await page.getByLabel('Clinic name',{exact:true}).fill('Instant Preview Dental');
  await page.getByLabel('Address / area').fill('Kazanchis, Addis Ababa');
  await page.getByRole('button',{name:'Add and build',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Instant Preview Dental',exact:true})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Design',exact:true})).toBeVisible();
});
