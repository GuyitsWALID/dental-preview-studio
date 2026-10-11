'use client';
import { Plus, Trash2 } from 'lucide-react';
import type { SiteReview } from '@/lib/site/types';
import type { ProspectResearch } from '@/lib/types';
import ClinicResearch from './ClinicResearch';
import { Field } from './ui';

export default function ReviewEditor({items,research,onChange}:{items:SiteReview[];research?:ProspectResearch;onChange:(reviews:SiteReview[])=>void}) {
  const edit=(index:number,patch:Partial<SiteReview>)=>onChange(items.map((r,i)=>i===index?{...r,...patch}:r));
  return <div className="form-section"><h3>Review highlights</h3><p className="caption">Chosen reviews appear in a continuous looping carousel, with pause, previous/next and reduced-motion support. Individual star ratings come only from supplied review data. No review-rating structured data is generated.</p>
    <details className="info-box"><summary>Choose from imported clinic research</summary><ClinicResearch research={research} selected={items} onAdd={reviews=>onChange([...items,...reviews])}/></details>
    {items.map((r,i)=><div className="repeat-card" key={i}><button className="remove-item text-action danger-text" aria-label="Remove review" onClick={()=>onChange(items.filter((_,j)=>i!==j))}><Trash2 size={14}/>Remove</button><Field label="Review wording"><select value={r.kind || 'quote'} onChange={e=>edit(i,{kind:e.target.value as 'quote'|'summary'})}><option value="quote">Verbatim excerpt</option><option value="summary">Paraphrased summary</option></select></Field><Field label={r.kind==='summary'?'Review summary':'Quote'}><textarea rows={4} value={r.quote} onChange={e=>edit(i,{quote:e.target.value})}/></Field><Field label="Reviewer"><input value={r.author} onChange={e=>edit(i,{author:e.target.value})}/></Field><Field label="Individual stars (optional)" hint="Leave blank when the original rating was not collected."><input type="number" min="1" max="5" step="1" value={r.rating??''} onChange={e=>edit(i,{rating:e.target.value===''?null:Number(e.target.value)})}/></Field><Field label="Review source URL"><input value={r.sourceUrl} onChange={e=>edit(i,{sourceUrl:e.target.value})}/></Field><Field label="Collected / checked date"><input type="date" value={r.checkedAt} onChange={e=>edit(i,{checkedAt:e.target.value})}/></Field><Field label="Age shown in source snapshot"><input value={r.dateLabel || ''} onChange={e=>edit(i,{dateLabel:e.target.value})}/></Field><Field label="Platform / origin"><input value={r.platform || ''} onChange={e=>edit(i,{platform:e.target.value})}/></Field><Field label="Snapshot context"><input value={r.snapshotContext || ''} onChange={e=>edit(i,{snapshotContext:e.target.value})}/></Field><Field label="Attribution"><input value={r.attribution || ''} onChange={e=>edit(i,{attribution:e.target.value})}/></Field></div>)}
    <button className="btn" onClick={()=>onChange([...items,{quote:'',author:'',sourceUrl:'',checkedAt:''}])}><Plus size={15}/>Add review manually</button>
  </div>;
}
