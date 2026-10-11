import { SITE_CSS } from './styles.mjs';
import { SITE_SCRIPT } from './runtime.mjs';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
export const slugify = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,70) || 'clinic';
export function safeHttps(value, hosts) {
  if (!value) return '';
  try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || (hosts && !hosts.includes(u.hostname))) return ''; return u.href; } catch { return ''; }
}
export const phoneDigits = value => String(value ?? '').replace(/[^0-9]/g, '');
// JSONB can reorder object keys. Compare content consistently while keeping
// array order significant for services, reviews, phones and other lists.
export function serializeSiteConfig(config) {
  return JSON.stringify(config, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}
export function validPhone(value) { return /^\+[1-9][0-9 ()-]{6,24}$/.test(String(value)) && phoneDigits(value).length >= 7 && phoneDigits(value).length <= 15; }
export function safeAssetPath(value) { return /^assets\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/.test(String(value)); }
export function createClinicConfig(input = {}) {
  const name = String(input.name || 'Your dental clinic');
  return {
    version: 1, name, tagline: '',
    theme: { primary:'#154A52', accent:'#E1F1EB', highlight:'#159085', font:'manrope' },
    logo:null, heroImage:null, coverImage:null,
    hero:{ eyebrow:'Dental care, close to you', title:`Welcome to ${name}`, body:'Contact our team to learn about the care we offer and plan your visit.' },
    about:{ title:'A conversation is a good place to start.', body:'' },
    location:{ address:String(input.address || ''), area:'', city:'Addis Ababa', country:'ET', mapsUrl:safeHttps(input.mapsUrl), embedUrl:'', latitude:null, longitude:null },
    phones:input.phone && validPhone(input.phone) ? [String(input.phone)] : [], hours:'', socials:[],
    rating:{ value:input.rating ?? null, count:input.reviews ?? null, checkedAt:input.checkedAt || '', sourceUrl:safeHttps(input.mapsUrl) },
    services:[], reviews:[], faqs:[], clinicians:[],
    sections:{ about:true, services:true, reviews:true, faq:true, contact:true },
    pages:{ mode:'landing', contact:false }, seo:{ title:'', description:'', siteUrl:'' },
    form:{ mode:'whatsapp', formspreeId:'', whatsappNumber:'', whatsappConfirmed:false }
  };
}
export function validateSiteConfig(c) {
  const errors = [];
  if (!c || c.version !== 1) return ['Unsupported clinic configuration version.'];
  // Strict shape checks keep private/unknown fields and malformed structured text
  // out of saved configurations and portable source files.
  const str = value => typeof value === 'string' && value.length <= 20000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
  const num = value => value === null || (typeof value === 'number' && Number.isFinite(value));
  const bool = value => typeof value === 'boolean';
  const obj = (shape, optional={}) => value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k=>Object.hasOwn(shape,k) || Object.hasOwn(optional,k)) && Object.entries(shape).every(([k,test])=>Object.hasOwn(value,k) && test(value[k])) && Object.entries(optional).every(([k,test])=>!Object.hasOwn(value,k) || test(value[k]));
  const list = test => value => Array.isArray(value) && value.length<=100 && value.every(test);
  const faq = obj({question:str,answer:str});
  const image = value => value === null || obj({path:str,alt:str,width:num,height:num})(value);
  const shape = obj({version:v=>v===1,name:str,tagline:str,theme:obj({primary:str,accent:str,highlight:str,font:str}),logo:image,heroImage:image,coverImage:image,hero:obj({eyebrow:str,title:str,body:str}),about:obj({title:str,body:str}),location:obj({address:str,area:str,city:str,country:str,mapsUrl:str,embedUrl:str,latitude:num,longitude:num}),phones:list(str),hours:str,socials:list(obj({label:str,url:str})),rating:obj({value:num,count:num,checkedAt:str,sourceUrl:str}),services:list(obj({id:str,title:str,summary:str,body:str,dedicatedPage:bool,seoTitle:str,seoDescription:str,faqs:list(faq)})),reviews:list(obj({quote:str,author:str,sourceUrl:str,checkedAt:str},{kind:v=>['quote','summary'].includes(v),rating:num,dateLabel:str,platform:str,attribution:str,snapshotContext:str})),faqs:list(faq),clinicians:list(obj({name:str,credentials:str})),sections:obj({about:bool,services:bool,reviews:bool,faq:bool,contact:bool}),pages:obj({mode:str,contact:bool}),seo:obj({title:str,description:str,siteUrl:str}),form:obj({mode:str,formspreeId:str,whatsappNumber:str,whatsappConfirmed:bool})});
  if (!shape(c)) return ['Invalid configuration shape or structured text. Use only the supported public clinic fields.'];
  if (!c.name?.trim()) errors.push('Enter the clinic name.');
  if (!c.theme || !['primary','accent','highlight'].every(k => /^#[0-9a-f]{6}$/i.test(c.theme[k]))) errors.push('Brand colors must be six-digit hex values.');
  if (!['jakarta','manrope'].includes(c.theme?.font)) errors.push('Choose a supported font.');
  if (!['landing','multipage'].includes(c.pages?.mode)) errors.push('Choose a supported page mode.');
  if (!['whatsapp','email'].includes(c.form?.mode)) errors.push('Choose a supported contact method.');
  for (const image of [c.logo,c.heroImage,c.coverImage].filter(Boolean)) {
    if (!safeAssetPath(image.path) || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width < 1 || image.height < 1) errors.push('Invalid image asset.');
  }
  const mapsHosts = ['www.google.com','google.com','maps.google.com','maps.app.goo.gl','goo.gl'];
  for (const url of [c.location?.mapsUrl,c.rating?.sourceUrl].filter(Boolean)) if (!safeHttps(url,mapsHosts)) errors.push('Use a valid HTTPS Google Maps link.');
  if (c.location?.embedUrl && (!safeHttps(c.location.embedUrl,['www.google.com','maps.google.com']) || !new URL(c.location.embedUrl).pathname.startsWith('/maps/embed'))) errors.push('Use a Google Maps embed URL, not iframe HTML.');
  for (const url of [...(c.socials || []).map(x => x.url),...(c.reviews || []).map(x => x.sourceUrl)].filter(Boolean)) if (!safeHttps(url)) errors.push('Social and review links must use HTTPS.');
  for (const p of c.phones || []) if (p && !validPhone(p)) errors.push('Use valid international clinic phone numbers.');
  if (c.form.whatsappNumber && !validPhone(c.form.whatsappNumber)) errors.push('Use a valid international WhatsApp number.');
  if (c.form.formspreeId && !/^[a-zA-Z0-9]{6,32}$/.test(c.form.formspreeId)) errors.push('Enter a Formspree form ID, not an email address or URL.');
  if (c.seo?.siteUrl) {
    const u = safeHttps(c.seo.siteUrl);
    if (!u || !['','/'].includes(new URL(u).pathname) || new URL(u).search || new URL(u).hash) errors.push('The final site URL must be an HTTPS domain without a path, query, or fragment.');
  }
  for (const n of [c.location?.latitude,c.location?.longitude,c.rating?.value,c.rating?.count]) if (n != null && !Number.isFinite(n)) errors.push('Coordinates and ratings must be numbers or blank.');
  if (c.location.latitude != null && Math.abs(c.location.latitude)>90) errors.push('Latitude must be between -90 and 90.');
  if (c.location.longitude != null && Math.abs(c.location.longitude)>180) errors.push('Longitude must be between -180 and 180.');
  if (c.rating.value != null && (c.rating.value<0 || c.rating.value>5)) errors.push('Rating must be between 0 and 5.');
  if (c.rating.count != null && (c.rating.count<0 || !Number.isInteger(c.rating.count))) errors.push('Review count must be a nonnegative whole number.');
  for (const r of c.reviews) if(r.rating!=null && (r.rating<1 || r.rating>5 || !Number.isInteger(r.rating))) errors.push('Individual review stars must be a whole number from 1 to 5.');
  const slugs = (c.services || []).filter(s => s.dedicatedPage).map(s => slugify(s.id || s.title));
  if (new Set(slugs).size !== slugs.length) errors.push('Each service page needs a unique slug.');
  if (JSON.stringify(c).length > 180000) errors.push('This clinic configuration is too large.');
  return [...new Set(errors)];
}
export function productionIssues(c) {
  const errors = validateSiteConfig(c);
  if (!safeHttps(c.seo?.siteUrl)) errors.push('Set the final HTTPS domain before a production export.');
  if (c.form?.mode === 'whatsapp' && (!c.form.whatsappConfirmed || !validPhone(c.form.whatsappNumber))) errors.push('Confirm the clinic’s WhatsApp-enabled number.');
  if (c.form?.mode === 'email' && !c.form.formspreeId) errors.push('Configure the clinic’s verified Formspree form ID.');
  return [...new Set(errors)];
}

export function renderClinicSite(c, options = { mode:'draft' }) {
  const errors = options.mode === 'production' ? productionIssues(c) : validateSiteConfig(c);
  if (errors.length) throw new Error(errors.join('\n'));
  const e = escapeHtml, production = options.mode === 'production';
  const base = options.basePath || '/';
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid site base path.');
  const url = p => base + p;
  const asset = p => options.assetUrls?.[p] || url(p);
  const siteUrl = production ? new URL(c.seo.siteUrl).origin : '';
  const mono = c.name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const logo = `<span class="brand-mark">${c.logo ? image(c.logo) : e(mono)}</span>`;
  const name = e(c.name), where = [c.location.area,c.location.city].filter(Boolean).join(', ');
  const contactLink = c.pages.mode === 'multipage' && c.pages.contact ? url('contact/') : c.sections.contact ? url('#visit') : '';
  const contactAnchor = (label, cls='') => contactLink ? `<a${cls?` class="${cls}"`:''} href="${contactLink}">${label}</a>` : '';
  const call = c.phones.find(validPhone);
  const callLink = call ? `tel:+${phoneDigits(call)}` : contactLink;
  const ext = (href,label,cls='') => safeHttps(href) ? `<a class="${cls}" href="${e(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
  function image(img, cls='', eager=false) { return `<img class="${cls}" src="${e(asset(img.path))}" alt="${e(img.alt)}" width="${img.width}" height="${img.height}" loading="${eager?'eager':'lazy'}"${eager?' fetchpriority="high"':''}>`; }
  const header = `${options.mode==='draft'?'<div class="site-alert">Working draft: configure your final HTTPS domain and enquiry method before a production rebuild. Forms here are demo-only.</div>':''}<a class="skip" href="#main">Skip to content</a>${!production?'<div class="concept">Website concept · for clinic review · enquiry forms are demo-only</div>':''}<header class="site-header"><div class="wrap header-row"><a class="brand" href="${url('')}">${logo}<span><strong>${name}</strong><small>${e(c.tagline || where)}</small></span></a><button class="menu" type="button" data-menu aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" data-nav aria-label="Main navigation"><a href="${url('')}">Home</a>${c.sections.services && c.services.length?`<a href="${url('#care')}">Care</a>`:''}${c.sections.reviews && c.reviews.length?`<a href="${url('#reviews')}">Reviews</a>`:''}${c.sections.about && c.about.body?`<a href="${url('#about')}">Our approach</a>`:''}${contactAnchor('Contact')}${callLink?`<a class="button" href="${callLink}">${call?'Call the clinic':'Plan your visit'} ↗</a>`:''}</nav></div></header>`;
  const publicSocials = c.socials.filter(s=>safeHttps(s.url));
  const socials = publicSocials.map(s=>ext(s.url,e(s.label))).join('');
  const footer = `<footer class="footer"><div class="wrap footer-grid"><div><a class="brand" href="${url('')}">${logo}<span><strong>${name}</strong><small>${e(c.tagline || where)}</small></span></a><p>${e(c.location.address)}</p><div class="social-links">${socials}</div><p>© ${new Date().getUTCFullYear()} ${name}</p></div><nav aria-label="Footer"><a href="${url('')}">Home</a>${contactAnchor('Contact and directions')}${ext(c.location.mapsUrl,'View on Google Maps')}</nav></div></footer>`;
  function faq(items) { return items.length?`<div class="faq-list">${items.filter(x=>x.question && x.answer).map(x=>`<details><summary>${e(x.question)}</summary><p>${e(x.answer)}</p></details>`).join('')}</div>`:''; }
  function contact() {
    const mode = production ? c.form.mode : 'demo';
    const action = mode === 'email' ? `https://formspree.io/f/${c.form.formspreeId}` : '';
    const formOpen = mode === 'demo' ? '<div class="form-grid">' : `<form class="form-grid" ${action?`action="${action}" method="post"`:''}>`;
    return `<section class="section tint" id="visit" aria-label="Clinic location and contact"><div class="wrap contact-grid"><div class="location-panel"><div class="location-top"><p class="eyebrow">Visit the clinic</p><h2>${e(c.location.area || c.location.city || 'Find us.')}</h2><p>${e(c.location.address)}</p></div>${c.location.embedUrl?`<iframe class="map" title="Map showing ${name}" src="${e(c.location.embedUrl)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`:`<div class="map-placeholder">${ext(c.location.mapsUrl,'Open the clinic’s location on Google Maps ↗','text-link') || '<p>Contact the clinic for directions.</p>'}</div>`}<div class="location-details">${ext(c.location.mapsUrl,'Get directions ↗','text-link')}<div class="phone-list">${c.phones.filter(validPhone).map(p=>`<a href="tel:+${phoneDigits(p)}">${e(p)}</a>`).join('')}</div>${c.hours?`<p><strong>Opening hours</strong><br>${e(c.hours).replace(/\n/g,'<br>')}</p>`:''}<div class="social-links">${socials}</div></div></div><div class="form-panel" data-enquiry data-mode="${mode}" data-phone="${phoneDigits(c.form.whatsappNumber)}"><p class="eyebrow">Start a conversation</p><h2>Ask about a visit.</h2><p>Tell the team how to reach you and what you would like to ask.</p><div class="form-note">${mode==='demo'?'Demo form only. Nothing entered here will be sent or saved.':mode==='whatsapp'?'This opens WhatsApp. Review the message and send it yourself.':'Your enquiry is sent to the clinic using Formspree.'}</div>${formOpen}<div class="form-field"><label for="enquiry-name">Full name</label><input id="enquiry-name" name="name" autocomplete="name" maxlength="120" required></div><div class="form-field"><label for="enquiry-phone">Phone <span>(optional)</span></label><input id="enquiry-phone" name="phone" type="tel" autocomplete="tel" maxlength="32"></div><div class="form-field full"><label for="enquiry-email">Email ${mode==='email'?'':'<span>(optional)</span>'}</label><input id="enquiry-email" name="email" type="email" autocomplete="email" maxlength="160" ${mode==='email'?'required':''}></div><div class="form-field full"><label for="enquiry-message">Your question</label><textarea id="enquiry-message" name="message" rows="4" maxlength="800" required></textarea></div><div class="trap" aria-hidden="true"><label>Leave this blank<input name="_gotcha" tabindex="-1" autocomplete="off"></label></div><div class="form-field full"><button class="button" data-send type="${mode==='email'?'submit':'button'}">${mode==='email'?'Send enquiry':mode==='whatsapp'?'Continue in WhatsApp':'Try the demo form'} →</button></div>${mode==='demo'?'</div>':'</form>'}<p class="fineprint">Please keep this to a short enquiry. Do not include medical records or sensitive health information.</p><p class="result" data-result role="status" tabindex="-1" hidden></p><noscript><p>Call the clinic directly${mode==='email'?' or submit the form above':''}. WhatsApp and preview interactions require JavaScript.</p></noscript></div></div></section>`;
  }
  function documentPage(path,title,description,body,breadcrumbs=[]) {
    const canonical = siteUrl ? `${siteUrl}/${path}` : '';
    const data = { '@context':'https://schema.org', '@type':'Dentist', name:c.name, ...(siteUrl?{'@id':`${siteUrl}/#clinic`,url:siteUrl+'/'}:{}), ...(c.location.address?{address:{'@type':'PostalAddress',streetAddress:c.location.address,addressLocality:c.location.city,addressCountry:c.location.country}}:{}), ...(call?{telephone:call}:{}), ...(c.location.mapsUrl?{hasMap:c.location.mapsUrl}:{}), ...(c.location.latitude != null && c.location.longitude != null?{geo:{'@type':'GeoCoordinates',latitude:c.location.latitude,longitude:c.location.longitude}}:{}), ...(/^(?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))? (?:[01][0-9]|2[0-3]):[0-5][0-9]-(?:[01][0-9]|2[0-3]):[0-5][0-9])(?:; ?(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))? (?:[01][0-9]|2[0-3]):[0-5][0-9]-(?:[01][0-9]|2[0-3]):[0-5][0-9])*$/.test(c.hours)?{openingHours:c.hours.split(/; ?/)}:{}), ...(publicSocials.length?{sameAs:publicSocials.map(s=>s.url)}:{}) };
    const schema = [data];
    if (production && breadcrumbs.length) schema.push({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:breadcrumbs.map((b,i)=>({'@type':'ListItem',position:i+1,name:b.name,item:siteUrl+'/'+b.path}))});
    const ogImage = production && (c.heroImage || c.logo) ? `${siteUrl}/${(c.heroImage || c.logo).path}` : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${c.theme.primary}"><title>${e(title)}</title><meta name="description" content="${e(description)}">${!production?'<meta name="robots" content="noindex, nofollow">':`<link rel="canonical" href="${e(canonical)}"><meta property="og:url" content="${e(canonical)}">`}<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website">${ogImage?`<meta property="og:image" content="${e(ogImage)}">`:''}<link rel="icon" href="${e(asset('favicon.svg'))}" type="image/svg+xml"><link rel="stylesheet" href="${asset('styles.css')}"><style>:root{--primary:${c.theme.primary};--accent:${c.theme.accent};--highlight:${c.theme.highlight};--font:${c.theme.font==='manrope'?'Manrope':'Jakarta'}}</style><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script><script defer src="${asset('main.js')}"></script></head><body>${header}<main id="main">${body}</main>${footer}</body></html>`;
  }
  const rating = c.rating.value != null && c.rating.count != null && c.rating.sourceUrl ? ext(c.rating.sourceUrl,`<span class="stars">${e(c.rating.value.toFixed(1))} / 5</span><span>From ${e(c.rating.count)} Google reviews${c.rating.checkedAt?`<small>Checked ${e(c.rating.checkedAt)}</small>`:''}</span>`,'rating') : '';
  let home = `<section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><p class="eyebrow">${e(c.hero.eyebrow)}</p><h1>${e(c.hero.title)}</h1><p>${e(c.hero.body)}</p><div class="hero-actions">${callLink?`<a class="button" href="${callLink}">${call?'Call to ask about a visit':'Contact the clinic'} ↗</a>`:''}${ext(c.location.mapsUrl,'Get directions →','text-link')}</div>${rating}</div><div><div class="hero-visual">${c.heroImage?image(c.heroImage,'',true):`<div class="hero-placeholder">${logo}<h3>${name}</h3><p>${e(where)}</p></div>`}</div></div></div></section>`;
  if (c.sections.services && c.services.length) home += `<section class="section" id="care"><div class="wrap"><div class="section-heading"><p class="eyebrow">Explore dental care</p><h2>Care shaped around your smile.</h2></div><div class="service-grid">${c.services.map(s=>`<article class="service-card"><span class="service-sign" aria-hidden="true">✧</span><h3>${e(s.title)}</h3><p>${e(s.summary)}</p>${c.pages.mode==='multipage' && s.dedicatedPage?`<a class="text-link" href="${url('services/'+slugify(s.id || s.title)+'/')}">Explore this service →</a>`:contactAnchor('Ask the clinic →','text-link')}</article>`).join('')}</div></div></section>`;
  if (c.sections.reviews && c.reviews.length) home += `<section class="section tint" id="reviews" aria-label="Patient review highlights"><div class="wrap"><div class="section-heading"><p class="eyebrow">Patient experiences</p><h2>Review highlights.</h2><p>Selected experiences shared by reviewers. Summaries are labelled and linked to their source.</p></div><div class="review-track" data-reviews tabindex="0" aria-label="Review highlights. Use arrow keys to scroll.">${c.reviews.map(r=>`<article class="review-card">${r.rating!=null?`<div class="stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>`:''}<small class="review-kind">${r.kind==='summary'?'Paraphrased review summary':'Review excerpt'}</small>${r.kind==='summary'?`<p class="review-text">${e(r.quote)}</p>`:`<blockquote class="review-text">${e(r.quote)}</blockquote>`}<p class="review-author">${e(r.author)}</p>${r.platform?`<small>${e(r.platform)}</small>`:''}${r.dateLabel?`<small>Age shown at source snapshot: ${e(r.dateLabel)}</small>`:''}${r.snapshotContext?`<small>${e(r.snapshotContext)}</small>`:''}${r.attribution?`<small>${e(r.attribution)}</small>`:''}<small>${ext(r.sourceUrl,'View review source ↗')}${r.checkedAt?` · Collected / checked ${e(r.checkedAt)}`:''}</small></article>`).join('')}</div><div class="review-controls"><span>Use the controls or swipe to browse.</span><div><button class="plain-button" type="button" data-review-prev aria-label="Previous review">←</button> <button class="plain-button" type="button" data-pause aria-pressed="false">Pause reviews</button> <button class="plain-button" type="button" data-review-next aria-label="Next review">→</button></div></div></div></section>`;
  if (c.sections.about && c.about.body) home += `<section class="section" id="about"><div class="wrap ${c.coverImage?'about-grid':''}">${c.coverImage?image(c.coverImage,'cover-photo'):''}<div><p class="eyebrow">Our approach</p><h2>${e(c.about.title)}</h2><p class="body-copy">${e(c.about.body)}</p>${c.clinicians.length?`<div class="clinicians">${c.clinicians.map(x=>`<p><strong>${e(x.name)}</strong>${x.credentials?' · '+e(x.credentials):''}</p>`).join('')}</div>`:''}${contactAnchor('Plan your visit →','button outline')}</div></div></section>`;
  if (c.sections.faq && c.faqs.length) home += `<section class="section tint"><div class="wrap"><div class="section-heading"><p class="eyebrow">Before your visit</p><h2>Your questions, answered.</h2></div>${faq(c.faqs)}</div></section>`;
  if (c.sections.contact) home += contact();
  const description = c.seo.description || `Learn about ${c.name}${where?' in '+where:''}, explore dental care, find directions and contact the clinic.`;
  const files = { 'index.html':documentPage('',c.seo.title || `${c.name} | Dental care${where?' in '+where:''}`,description,home), 'styles.css':SITE_CSS, 'main.js':SITE_SCRIPT, 'favicon.svg':`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${c.theme.primary}"/><text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="bold" fill="${c.theme.accent}">${e(mono)}</text></svg>` };
  const pagePaths = [''];
  if (c.pages.mode === 'multipage') {
    if (c.pages.contact) { const p='contact/'; pagePaths.push(p); files[p+'index.html']=documentPage(p,`Contact ${c.name} | ${where}`,`Find ${c.name}, opening hours, directions and enquiry options.`,`<section class="page-hero"><div class="wrap"><p class="eyebrow">Contact ${name}</p><h1>Find us. Start a conversation.</h1></div></section>${contact()}`,[{name:'Home',path:''},{name:'Contact',path:p}]); }
    for (const s of c.services.filter(s=>s.dedicatedPage)) {
      const p='services/'+slugify(s.id || s.title)+'/'; pagePaths.push(p);
      files[p+'index.html']=documentPage(p,s.seoTitle || `${s.title} | ${c.name}`,s.seoDescription || s.summary,`<section class="page-hero"><div class="wrap"><div class="breadcrumbs"><a href="${url('')}">Home</a> / ${e(s.title)}</div><p class="eyebrow">Dental care${where?' in '+e(where):''}</p><h1>${e(s.title)}</h1><p>${e(s.summary)}</p></div></section><section class="section"><div class="wrap"><p class="body-copy">${e(s.body)}</p>${faq(s.faqs)}${contactLink?`<p>${contactAnchor(`Ask the clinic about ${e(s.title.toLowerCase())} →`,'button')}</p>`:''}</div></section>`,[{name:'Home',path:''},{name:s.title,path:p}]);
    }
  }
  files['robots.txt'] = production ? `User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n` : 'User-agent: *\nAllow: /\n# Preview HTML supplies noindex. Allow crawling so crawlers can read it.\n';
  if (production) files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pagePaths.map(p=>`<url><loc>${e(siteUrl+'/'+p)}</loc></url>`).join('')}</urlset>`;
  return files;
}
