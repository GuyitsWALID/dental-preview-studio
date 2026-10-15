'use client';
import { useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { Field, Modal } from './ui';
import type { LeadFacts } from '@/lib/types';

export interface QuickAddData {
  facts: LeadFacts;
}

interface Props {
  onClose: () => void;
  onConfirm: (data: QuickAddData) => Promise<void>;
  onBuild: (data: QuickAddData) => Promise<void>;
  onError: (message: string) => void;
}

const blankFacts=():LeadFacts=>({name:'',address:'',phone:'',email:'',socialNotes:'',socialUrls:[],rating:null,reviews:null,websiteStatus:'No owned website found — verify before outreach',seoPresence:'',aeoPresence:'',confidence:'Medium',evidence:'Added manually from a Google Maps listing.',mapsUrl:'',verificationSource:'',score:null,priority:'',importedStage:'',notes:''});

export default function QuickAddDialog({onClose,onConfirm,onBuild,onError}:Props) {
  const [facts,setFacts]=useState(blankFacts),[busy,setBusy]=useState(false);
  const update=(key:keyof LeadFacts,value:unknown)=>setFacts(current=>({...current,[key]:value}));
  const data:QuickAddData={facts};
  async function finish(build:boolean) {
    setBusy(true);
    try {await (build?onBuild(data):onConfirm(data));onClose();}
    catch(error) {onError((error as Error).message);}
    finally {setBusy(false);}
  }
  return <Modal title="Quick add from Google Maps" onClose={busy?()=>{}:onClose}>
    <div className="modal-body"><p className="caption">Copy facts from a specific clinic listing. The studio validates them before saving. Confirm the clinic identity and website status yourself.</p>
      <Field label="Google Maps place URL"><input type="url" value={facts.mapsUrl} onChange={e=>update('mapsUrl',e.target.value)} placeholder="https://www.google.com/maps/place/…"/></Field>
      <Field label="Clinic name"><input value={facts.name} onChange={e=>update('name',e.target.value)}/></Field>
      <Field label="Address / area"><input value={facts.address} onChange={e=>update('address',e.target.value)}/></Field>
      <div className="two-fields"><Field label="Phone"><input value={facts.phone} onChange={e=>update('phone',e.target.value)} placeholder="+251…"/></Field><Field label="Email"><input type="email" value={facts.email} onChange={e=>update('email',e.target.value)}/></Field></div>
      <div className="two-fields"><Field label="Google rating"><input type="number" min="0" max="5" step="0.1" value={facts.rating??''} onChange={e=>update('rating',e.target.value===''?null:Number(e.target.value))}/></Field><Field label="Review count"><input type="number" min="0" step="1" value={facts.reviews??''} onChange={e=>update('reviews',e.target.value===''?null:Number(e.target.value))}/></Field></div>
      <Field label="Verification note"><textarea rows={3} value={facts.evidence} onChange={e=>update('evidence',e.target.value)}/></Field>
    </div><div className="modal-footer"><button className="btn" disabled={busy} onClick={onClose}>Cancel</button><button className="btn" disabled={busy || !facts.name.trim() || !facts.mapsUrl.trim()} onClick={()=>void finish(false)}><MapPin size={15}/>Add prospect</button><button className="btn primary" disabled={busy || !facts.name.trim() || !facts.mapsUrl.trim()} onClick={()=>void finish(true)}>Add and build <ArrowRight size={15}/></button></div>
  </Modal>;
}
