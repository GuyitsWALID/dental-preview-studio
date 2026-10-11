import { renderClinicSite, safeAssetPath } from './site/renderer.mjs';
import type { Project, Workspace, Release, Asset } from './types';
export const fileMime = (p:string) => p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':p.endsWith('.js') || p.endsWith('.mjs')?'text/javascript; charset=utf-8':p.endsWith('.woff2')?'font/woff2':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.webp')?'image/webp':p.endsWith('.jpg')?'image/jpeg':p.endsWith('.png')?'image/png':p.endsWith('.xml')?'application/xml; charset=utf-8':'text/plain; charset=utf-8';
export function projectAssets(project:Project,state:Workspace): Asset[] {
  const paths=[project.config.logo,project.config.heroImage,project.config.coverImage].filter(Boolean).map(x=>x!.path);
  return [...new Set(paths)].map(p=>{
    const asset=state.assets.find(a=>a.path===p);
    if (!safeAssetPath(p) || !asset) throw new Error('A selected image is missing. Upload it again before publishing or exporting.');
    return asset;
  });
}
export function releaseManifest(project:Project,id:string) {
  const base=`/preview/${project.slug}/`, releaseBase=`${base}_releases/${id}/`;
  const assetUrls:Record<string,string>={'styles.css':releaseBase+'styles.css','main.js':releaseBase+'main.js','favicon.svg':releaseBase+'favicon.svg'};
  for (const img of [project.config.logo,project.config.heroImage,project.config.coverImage].filter(Boolean)) assetUrls[img!.path]=releaseBase+img!.path;
  return renderClinicSite(project.config,{mode:'preview',basePath:base,assetUrls});
}
export function resolvePreview(state:Workspace,slug:string,segments:string[]): { release:Release; file:{key:string;mime:string} } | null {
  const project=state.projects.find(p=>p.slug===slug);
  if (!project?.publishedReleaseId || segments.some(s=>!s || s==='.' || s==='..' || !/^[a-zA-Z0-9_.-]+$/.test(s))) return null;
  let releaseId=project.publishedReleaseId, filePath='';
  if (segments[0]==='_releases') {
    if (segments.length<3) return null;
    releaseId=segments[1]; filePath=segments.slice(2).join('/');
    if (filePath.endsWith('.html')) return null;
  } else {
    filePath=segments.join('/');
    if (!filePath || !filePath.split('/').at(-1)!.includes('.')) filePath+=(filePath?'/':'')+'index.html';
    if (!filePath.endsWith('.html')) return null;
  }
  const release=state.releases.find(r=>r.id===releaseId && r.projectId===project.id && r.published);
  if (!release || !Object.hasOwn(release.files,filePath)) return null;
  return {release,file:release.files[filePath]};
}
