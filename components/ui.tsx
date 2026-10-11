'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}) {return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;}
export function Check({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean}) {return <label className="check"><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label>;}
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();return ()=>ref.current?.close();},[]);
  return <dialog ref={ref} className={`modal ${wide?'wide':''}`} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-labelledby="modal-title"><div className="modal-head"><h2 id="modal-title">{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</dialog>;
}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'good'|'warm'}) {return <span className={`badge ${tone}`}>{children}</span>;}
