import JSZip from 'jszip';
import { renderClinicSite } from './site/renderer.mjs';
import type { ClinicSiteConfig } from './site/types';
export interface ExportBundle { config:ClinicSiteConfig;slug:string;mode:'draft'|'production';images:{path:string;url:string}[];fontUrls:{path:string;url:string}[];sources:Record<string,string>;hasUnpublishedChanges:boolean }
const buildScript = `import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderClinicSite} from './renderer.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(await readFile(path.join(here,'clinic.json'),'utf8'));
const deployment=JSON.parse(await readFile(path.join(here,'deployment.json'),'utf8'));
const out=path.resolve(here,'../site');
const manifest=renderClinicSite(config,{mode:deployment.mode,basePath:'/'});
// Remove only generated page/metadata files recorded by the prior build.
let old=[];try {old=JSON.parse(await readFile(path.join(here,'generated-files.json'),'utf8'));}catch{}
const {rm}=await import('node:fs/promises');
for (const p of old) {if(typeof p==='string' && /^(?:[a-zA-Z0-9_-]+\\/)*[a-zA-Z0-9_.-]+$/.test(p) && !p.split('/').includes('..')) await rm(path.join(out,p),{force:true});}
await mkdir(out,{recursive:true});
for (const [p,body] of Object.entries(manifest)) {const target=path.join(out,p);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,body);}
async function copyTree(src,dst) {await mkdir(dst,{recursive:true});for(const e of await readdir(src,{withFileTypes:true})){const a=path.join(src,e.name),b=path.join(dst,e.name);if(e.isDirectory())await copyTree(a,b);else await copyFile(a,b);}}
await copyTree(path.join(here,'assets'),path.join(out,'assets'));
await writeFile(path.join(here,'generated-files.json'),JSON.stringify(Object.keys(manifest),null,2));
console.log('Rebuilt site/. Upload the CONTENTS of site/ to your hosting web root.');
`;
export const EXPORT_README = `# Your clinic website

Upload only the CONTENTS of site/ to your static hosting web root. Keep source/ on your computer.
The website does not require Next.js, Supabase, or the studio. Images and fonts are local.
Google Maps, social links and your chosen enquiry provider remain optional external connections.

## Edit and rebuild
1. Edit source/clinic.json: branding, copy, services, images, public contact details and seo.siteUrl.
2. For WhatsApp, set form.mode to whatsapp, form.whatsappNumber to an international number and form.whatsappConfirmed to true only after verification.
3. For email, set form.mode to email and form.formspreeId to a verified clinic-specific Formspree ID. Configure its recipient and domain restrictions in Formspree. No secret or SMTP credentials belong in this project.
4. Edit source/deployment.json: mode is draft (noindex/demo forms) or production (final HTTPS domain and configured form required).
5. With Node.js 22 or later, run: node source/build.mjs

Add/replace images in source/assets/ and update their path, alt text, width and height in clinic.json. Use JPEG, PNG or WebP; no remote hotlinks or SVG.
The rebuild script removes stale GENERATED pages listed in source/generated-files.json, then writes the new site. Back up manual edits to generated HTML first.

## Launch checklist
- Confirm the clinic name, location, hours, phones, services, review sources and images with the clinic. Keep illustrative-image labels truthful.
- Use the final HTTPS domain in seo.siteUrl. Rebuild in production mode.
- Verify nested service/contact URLs and all local assets on your host. Enable HTTPS and folder index.html serving.
- For email, verify the recipient and test delivery with an authorized test inbox. For WhatsApp, verify the correct number opens and the visitor explicitly sends the message.
- Check no preview URLs, concept notices or noindex tags remain in the production files.
- Verify the domain in Google Search Console and submit /sitemap.xml; optionally do the same in Bing Webmaster Tools.
- Add the correct website URL to the clinic's Google Business Profile and keep its name, address, phone and hours consistent.
- Check the structured data against the visible page. Google review highlights do not generate self-serving review-star markup.
- Search/AI visibility depends on indexing, content and platform decisions. No ranking or citation is guaranteed. OAI-SearchBot controls ChatGPT search crawling separately from model-training preferences.
`;
export async function buildProjectZip(bundle:ExportBundle,fetchAsset:(url:string)=>Promise<Uint8Array> = async url=>{const r=await fetch(url);if(!r.ok)throw new Error('An asset could not be downloaded. Retry the export.');return new Uint8Array(await r.arrayBuffer());}) {
  const zip=new JSZip(),files=renderClinicSite(bundle.config,{mode:bundle.mode,basePath:'/'});
  for (const [p,body] of Object.entries(files)) zip.file('site/'+p,body);
  for (const [name,body] of Object.entries(bundle.sources)) zip.file('source/'+name,body);
  zip.file('source/clinic.json',JSON.stringify(bundle.config,null,2));
  zip.file('source/deployment.json',JSON.stringify({mode:bundle.mode},null,2));
  zip.file('source/generated-files.json',JSON.stringify(Object.keys(files),null,2));
  zip.file('source/build.mjs',buildScript); zip.file('README.md',EXPORT_README);
  await Promise.all([...bundle.images,...bundle.fontUrls].map(async a=>{const data=await fetchAsset(a.url);zip.file('site/'+a.path,data);zip.file('source/'+a.path,data);}));
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
