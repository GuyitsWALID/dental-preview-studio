import 'server-only';
import { HttpError } from './auth';
import { placeFromFirecrawl, mapsPlaceId, type FirecrawlPlace, type GooglePlace } from '../places';
import { safeHttps } from '../site/renderer.mjs';

const SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
export const mapsHosts = ['www.google.com', 'google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'];
// Google Maps photo CDN hosts. safeHttps matches exactly, so list each shard.
const photoHosts = ['lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com', 'maps.googleapis.com', 'streetviewpixels-pa.googleapis.com'];
const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    address: { type: 'string' },
    phone: { type: 'string' },
    rating: { type: 'number' },
    reviewCount: { type: 'number' },
    reviews: { type: 'array', items: { type: 'object', properties: { author: { type: 'string' }, rating: { type: 'number' }, text: { type: 'string' } } } },
    photos: { type: 'array', items: { type: 'string' } },
  },
};
const EXTRACT_PROMPT = 'Extract the dental clinic listing shown on this Google Maps page: the business name, full formatted address, international phone number, star rating, total review count, up to three reviews and up to three clinic photo image URLs. Only report values actually visible on the page; never invent, guess or use placeholder values.';
// The Maps page renders only three reviews inline; the rest load after opening the
// Reviews tab. Firecrawl actions are unavailable here, so open it via a browser
// session and read the first five real reviews from the DOM.
const REVIEW_CODE = `let clicked=false;
const btns=await page.$$('button');
for(const b of btns){const t=((await b.innerText().catch(()=>''))||'').trim();if(/^reviews?/i.test(t)&&t.length<20){await b.click().catch(()=>{});clicked=true;break;}}
await page.waitForTimeout(3000);
const rows=await page.$$eval('[data-review-id]',els=>els.map(e=>{const lines=(e.innerText||'').split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean);const author=lines.find(l=>!/review|ago$|^Like$|^Share$|^[0-9]+$/.test(l))||'';const dateLabel=lines.find(l=>/ago$/.test(l))||'';const star=e.querySelector('[role="img"][aria-label*="star"]');const rating=Number((String(star&&star.getAttribute('aria-label')||'').match(/[0-9]+/)||[])[0])||null;const text=lines.filter(l=>l!==author&&l!==dateLabel&&!/^Like$|^Share$/.test(l)).sort((a,b)=>b.length-a.length)[0]||'';return {id:e.getAttribute('data-review-id'),author,rating,dateLabel,text};}).filter(r=>r.text&&r.text.length>3));
const seen=new Set();const out=[];
for(const r of rows){if(!r.id||seen.has(r.id))continue;seen.add(r.id);out.push({author:r.author,rating:r.rating,dateLabel:r.dateLabel,text:r.text});if(out.length>=15)break;}
console.log(JSON.stringify({reviews:out}));`;

interface FirecrawlReview { author?: string; rating?: number; text?: string; dateLabel?: string }

async function firecrawlScrape(apiKey: string, url: string): Promise<{ place: FirecrawlPlace; scrapeId: string }> {
  let response: Response;
  try {
    response = await fetch(SCRAPE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      // markdown keeps a live browser session open for the reviews interact step.
      body: JSON.stringify({ url, formats: ['markdown', { type: 'json', schema: EXTRACT_SCHEMA, prompt: EXTRACT_PROMPT }], location: { languages: ['en'] }, waitFor: 4000 }),
      signal: AbortSignal.timeout(60000),
    });
  } catch { throw new HttpError(502, 'Firecrawl could not be reached. Try again.'); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new HttpError(502, 'Firecrawl rejected the request. Check FIRECRAWL_API_KEY.');
    throw new HttpError(502, `Firecrawl scrape failed (${response.status}).`);
  }
  const payload = await response.json() as { success?: boolean; data?: { json?: FirecrawlPlace; metadata?: { scrapeId?: string } }; error?: string };
  if (!payload.success || !payload.data?.json) throw new HttpError(502, payload.error || 'Firecrawl returned no clinic details for that page.');
  return { place: payload.data.json, scrapeId: String(payload.data.metadata?.scrapeId || '') };
}

async function firecrawlReviews(apiKey: string, scrapeId: string): Promise<FirecrawlReview[]> {
  if (!scrapeId) return [];
  let response: Response;
  try {
    response = await fetch(`https://api.firecrawl.dev/v2/scrape/${encodeURIComponent(scrapeId)}/interact`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: REVIEW_CODE, language: 'node', timeout: 60 }),
      signal: AbortSignal.timeout(60000),
    });
  } catch { return []; }
  if (!response.ok) return [];
  const payload = await response.json() as { success?: boolean; stdout?: string };
  if (!payload.success || !payload.stdout) return [];
  const line = payload.stdout.split('\n').reverse().find(l => l.trim().startsWith('{'));
  if (!line) return [];
  try { const parsed = JSON.parse(line) as { reviews?: FirecrawlReview[] }; return Array.isArray(parsed.reviews) ? parsed.reviews : []; }
  catch { return []; }
}

export async function lookupClinic(apiKey: string, input: { url?: string; name?: string; address?: string }): Promise<GooglePlace> {
  const url = String(input.url || '').trim();
  if (url && !safeHttps(url, mapsHosts)) throw new HttpError(400, 'Use a valid HTTPS Google Maps place URL.');
  let target = url;
  if (!target) {
    const query = [input.name, input.address].map(v => String(v || '').trim()).filter(Boolean).join(', ');
    if (!query) throw new HttpError(400, 'Enter a clinic name or paste its Google Maps URL.');
    target = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  const { place: data, scrapeId } = await firecrawlScrape(apiKey, mapsEnglish(target));
  const reviews = await firecrawlReviews(apiKey, scrapeId);
  if (reviews.length) data.reviews = reviews;
  const place = placeFromFirecrawl(data);
  place.id = mapsPlaceId(target);
  return place;
}

// Google localizes the listing to the scraper's region; hl=en keeps the address
// and review text in English.
function mapsEnglish(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.set('hl', 'en');
  return parsed.href;
}

export async function fetchPhotoBytes(url: string): Promise<Buffer> {
  if (!safeHttps(url, photoHosts)) throw new HttpError(400, 'Unsupported photo URL.');
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(20000) }); }
  catch { throw new HttpError(502, 'A photo could not be downloaded.'); }
  if (!response.ok) throw new HttpError(502, 'A photo could not be downloaded.');
  return Buffer.from(await response.arrayBuffer());
}
