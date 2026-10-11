// Run after npm run build. No real Supabase project or credentials are used.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const base='http://127.0.0.1:3011';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'],{env:{...process.env,NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://studio-auth-test.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-publishable-key',SUPABASE_SECRET_KEY:'test-server-key',STUDIO_OWNER_ID:'00000000-0000-4000-8000-000000000099',STUDIO_LOCAL_DEMO:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
try {
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+'/login');if(r.ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw new Error(output);await delay(200);}
  assert.ok(ready,'Production server did not become ready. '+output);
  const home=await fetch(base+'/',{redirect:'manual'});assert.equal(home.status,307);assert.equal(new URL(home.headers.get('location'),base).pathname,'/login');
  for(const route of ['/api/studio','/api/assets/00000000-0000-4000-8000-000000000001']){
    const r=await fetch(base+route);assert.equal(r.status,401,route);const text=await r.text();assert.ok(!text.includes('prospects'));assert.ok(!text.includes('test-server-key'));
  }
  for(const route of ['/api/studio','/api/import','/api/upload']){
    const r=await fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'export',projectId:'00000000-0000-4000-8000-000000000002'})});assert.equal(r.status,401,route);
  }
  console.log('PASS: anonymous production visitors cannot open the dashboard, prospect records, assets, editing, imports, uploads or exports. Development demo flag is ignored.');
} finally {server.kill();}
