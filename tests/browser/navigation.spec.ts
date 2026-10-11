import { test, expect } from './fixtures';
test('sidebar and back navigation preserve unsaved edits when cancelled and allow saved navigation',async({page,context})=>{
  await context.route('https://**/*',route=>route.fulfill({body:'Mock external connection'}));
  await page.goto('/');await page.getByRole('button',{name:'Clinic projects',exact:false}).first().click();await page.getByRole('button',{name:'Edit website'}).first().click();
  const name=page.getByLabel('Clinic name',{exact:true}),savedName=await name.inputValue();await name.fill('Unsaved clinic name');
  for(const target of [page.getByRole('navigation',{name:'Studio navigation'}).getByRole('button',{name:'Prospects'}),page.getByRole('navigation',{name:'Studio navigation'}).getByRole('button',{name:'Clinic projects'}),page.getByRole('button',{name:'Clinic projects',exact:true})]) {
    page.once('dialog',dialog=>dialog.dismiss());await target.click();await expect(name).toHaveValue('Unsaved clinic name');
  }
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('navigation',{name:'Studio navigation'}).getByRole('button',{name:'Prospects'}).click();await expect(page.getByRole('heading',{name:'Find your next clinic.'})).toBeVisible();
  await page.getByRole('navigation',{name:'Studio navigation'}).getByRole('button',{name:'Clinic projects'}).click();await page.getByRole('button',{name:'Edit website'}).first().click();await expect(name).toHaveValue(savedName);
  // Returning a field to its saved value removes the warning as well.
  await name.fill('Temporary change');await name.fill(savedName);
  let unexpected=false;page.on('dialog',async dialog=>{unexpected=true;await dialog.dismiss();});
  await page.getByRole('navigation',{name:'Studio navigation'}).getByRole('button',{name:'Prospects'}).click();await expect(page.getByRole('heading',{name:'Find your next clinic.'})).toBeVisible();expect(unexpected).toBe(false);
});
