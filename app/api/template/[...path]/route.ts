import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileMime } from '@/lib/publication';
import { SITE_CSS } from '@/lib/site/styles.mjs';
import { SITE_SCRIPT } from '@/lib/site/runtime.mjs';
export async function GET(_request:Request,context:{params:Promise<{path:string[]}>}) {
  const {path:parts}=await context.params,key=parts.join('/');
  let body:string|Uint8Array<ArrayBuffer>;
  if(key==='styles.css')body=SITE_CSS;
  else if(key==='main.js')body=SITE_SCRIPT;
  else if(/^assets\/fonts\/(jakarta|manrope)(-bold)?\.woff2$/.test(key))body=new Uint8Array(await readFile(path.join(process.cwd(),'public/studio-fonts',parts.at(-1)!)));
  else return new Response('Not found.',{status:404});
  return new Response(body,{headers:{'Content-Type':fileMime(key),'X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'}});
}
