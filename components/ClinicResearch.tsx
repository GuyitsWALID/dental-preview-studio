'use client';
import { useState } from 'react';
import type { ProspectResearch, ResearchReview, ResearchRecord } from '@/lib/types';
import type { SiteReview } from '@/lib/site/types';
import { safeHttps } from '@/lib/site/renderer.mjs';
import { Badge, Check } from './ui';

export function sameReview(a:SiteReview,b:ResearchReview) {return a.quote===b.text && a.author===b.author && a.sourceUrl===b.sourceUrl;}
export function publicReview(r:ResearchReview):SiteReview {
  return {quote:r.text,author:r.author,sourceUrl:r.sourceUrl,checkedAt:r.checkedAt,kind:r.kind,rating:r.rating,dateLabel:r.dateLabel,platform:r.platform,attribution:r.attribution,snapshotContext:r.snapshotContext};
}
function RecordDetails({record}:{record:ResearchRecord}) {
  return <><dl>{Object.entries(record.values).filter(([,value])=>value!==null && value!=='').map(([label,value])=><div key={label}><dt>{label}</dt><dd>{safeHttps(String(value))?<a href={String(value)} target="_blank" rel="noreferrer">{String(value)}</a>:String(value)}</dd></div>)}</dl><p className="caption">{record.provenance.filename} · {record.provenance.sheet} · row {record.provenance.row} · {record.provenance.researchDate || 'Date not supplied'}</p></>;
}
export default function ClinicResearch({research,selected,onAdd}:{research?:ProspectResearch;selected?:SiteReview[];onAdd?:(reviews:SiteReview[])=>void}) {
  const [chosen,setChosen]=useState<string[]>([]),[approved,setApproved]=useState(false);
  if(!research)return <p className="caption">Import the enriched workbook to see clinic details, review candidates and asset references.</p>;
  const candidates=research.reviews.filter(r=>!selected?.some(s=>sameReview(s,r)));
  const ready=candidates.filter(r=>chosen.includes(r.id));
  return <div className="clinic-research"><div className="detail-top"><Badge>{research.clinicId}</Badge><span className="caption">{research.reviews.length} collected review records · {research.assets.length} asset references</span></div><details className="info-box"><summary>Enriched clinic details and identity checks</summary><RecordDetails record={research.details}/></details><p className="caption">{String(research.details.values['Review coverage'] || 'Review coverage not supplied.')}</p>
    {!research.reviews.length?<div className="info-box">No review text was collected for this clinic. Its Google rating and count are a separate snapshot. Existing website reviews remain editable.</div>:<><h4>Collected review candidates</h4><p className="caption">These are imported research records. Check the exact clinic, source and wording before adding them to a public website. Paraphrases remain labelled as summaries.</p>{research.reviews.map(r=>{
      const added=selected?.some(s=>sameReview(s,r));return <article className="repeat-card" key={r.id}><div className="detail-top"><strong>{r.author || 'Reviewer not supplied'}</strong><Badge tone={r.issues.length?'warm':'neutral'}>{r.rating==null?'Stars not supplied':`${r.rating}/5`}</Badge></div><p className="caption">{r.kind==='summary'?'Paraphrased summary':'Verbatim excerpt'} · {r.platform} · Collected {r.checkedAt || 'date not supplied'}</p><p>{r.text}</p>{r.dateLabel && <p className="caption">Age at source snapshot: {r.dateLabel}</p>}{r.snapshotContext && <p className="caption">{r.snapshotContext}</p>}{r.issues.map(issue=><p className="danger-text" key={issue}>{issue}</p>)}{safeHttps(r.sourceUrl) && <a className="text-action" href={r.sourceUrl} target="_blank" rel="noreferrer">Open review source ↗</a>}{onAdd && (added?<p className="caption">Already in this draft</p>:<Check label={`Select review by ${r.author || 'unnamed reviewer'}`} checked={chosen.includes(r.id)} disabled={r.issues.some(i=>i==='Invalid individual star rating' || i==='Missing or invalid HTTPS review source')} onChange={value=>{setChosen(ids=>value?[...ids,r.id]:ids.filter(id=>id!==r.id));setApproved(false);}}/>)}</article>;
    })}{onAdd && <><Check label="I checked the selected reviews, clinic identity and source attribution for this website" checked={approved} onChange={setApproved}/><button className="btn" disabled={!ready.length || !approved} onClick={()=>{onAdd(ready.map(publicReview));setChosen([]);setApproved(false);}}>Add {ready.length || 'selected'} reviews to draft</button></>}</>}
    {research.assets.length>0 && <details className="info-box"><summary>Asset references ({research.assets.length})</summary><p className="caption">These are source links and candidates. Verify identity and reuse, then upload an image through the Brand tab.</p>{research.assets.map((asset,i)=><div className="repeat-card" key={i}><RecordDetails record={asset}/></div>)}</details>}
  </div>;
}
