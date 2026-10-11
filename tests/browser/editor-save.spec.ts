import { test, expect } from './fixtures';

// The filesystem demo retains key order; Supabase JSONB does not.
function reorderKeys(value:unknown):unknown {
  if(Array.isArray(value))return value.map(reorderKeys);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorderKeys(item)]));
  return value;
}

test('saving a JSONB-reordered draft enables preview publishing and keeps real edits unsaved',async({page,context})=>{
  await context.route('https://**/*',route=>route.fulfill({body:'External connection mocked.'}));
  await page.route('**/api/studio',async route=>{
    if(route.request().method()!=='GET'){await route.continue();return;}
    const response=await route.fetch();
    await route.fulfill({response,json:reorderKeys(await response.json())});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Clinic projects',exact:false}).first().click();
  await page.getByRole('button',{name:'Edit website'}).first().click();
  const name=page.getByLabel('Clinic name',{exact:true});
  await name.fill('Saved Clinic '+Date.now());
  await page.getByLabel('Preview URL slug').fill('Saved Clinic Website');
  await expect(page.getByRole('button',{name:'Publish preview',exact:true})).toHaveAttribute('title','Save your draft before publishing.');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByText('Private draft saved.',{exact:false})).toBeVisible();
  await expect(page.getByLabel('Preview URL slug')).toHaveValue('saved-clinic-website');
  await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Publish preview',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Export ZIP',exact:true})).toBeEnabled();

  await page.getByRole('tab',{name:'Content',exact:true}).click();
  await page.getByLabel('Main heading').fill('A new unsaved heading');
  await expect(page.getByRole('button',{name:'Publish preview',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByRole('button',{name:'Publish preview',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Publish preview',exact:true}).click();
  await expect(page.getByText('Preview published. Your stable pitch link is ready.',{exact:true})).toBeVisible();
});
