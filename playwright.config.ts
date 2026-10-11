import { defineConfig } from '@playwright/test';
const port=Number(process.env.STUDIO_TEST_PORT || 3013);
if(!Number.isInteger(port) || port<1024 || port>65535) throw new Error('Invalid STUDIO_TEST_PORT.');
const id=Date.now()+'-'+process.pid;
const origin=`http://127.0.0.1:${port}`;
process.env.STUDIO_TEST_ORIGIN=origin;
export default defineConfig({
  testDir:'./tests/browser',timeout:180000,expect:{timeout:30000},fullyParallel:false,workers:1,reporter:'list',
  use:{baseURL:origin,headless:true,trace:'retain-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined}},
  webServer:{command:`npm run dev -- --webpack --port ${port}`,url:origin,reuseExistingServer:false,timeout:120000,
    env:{STUDIO_LOCAL_DEMO:'1',STUDIO_LOCAL_DATA_DIR:'.cache/browser-data-'+id,STUDIO_TEST_BUILD_DIR:'.cache/browser-next-'+id}}
});
