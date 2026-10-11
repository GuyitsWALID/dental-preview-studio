import { test as base, expect } from '@playwright/test';
// Refuse to mutate a normal development or deployed workspace, even if the
// browser-test server configuration is accidentally changed later.
export const test=base.extend<{isolatedStudio:void}>({
  isolatedStudio:[async({request},use)=>{
    const response=await request.get('/api/studio');
    expect(response.headers()['x-studio-mode'],'Browser checks require the isolated local demo').toBe('local-demo');
    await use();
  },{auto:true}]
});
export { expect };
