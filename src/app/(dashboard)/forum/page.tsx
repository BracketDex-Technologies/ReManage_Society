"use client";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { MessageSquare, Plus, Eye, MessageCircle, Pin, Search, X, Send, ArrowLeft, Clock } from "lucide-react";
import { ModuleEmptyState, ModulePageHeader } from "@/components/ux/ModulePageKit";

interface Thread { id: string; title: string; content: string; category: string; isPinned: boolean; isLocked: boolean; views: number; lastActivityAt: string; createdAt: string; author: { name: string; role: string }; _count: { replies: number }; }
interface Reply { id: string; content: string; createdAt: string; author: { name: string; role: string }; }
interface ThreadDetail extends Thread { replies: Reply[]; }

const cats = [{ key: "all", label: "All" },{ key: "general", label: "General" },{ key: "maintenance", label: "Maintenance" },{ key: "security", label: "Security" },{ key: "events", label: "Events" },{ key: "buy-sell", label: "Buy/Sell" },{ key: "lost-found", label: "Lost & Found" }];
const catClr: Record<string,string> = { general:"bg-blue-50 text-blue-600", maintenance:"bg-amber-50 text-amber-600", security:"bg-red-50 text-red-600", events:"bg-violet-50 text-violet-600", "buy-sell":"bg-emerald-50 text-emerald-600", "lost-found":"bg-orange-50 text-orange-600" };

function timeAgo(d:string){ const m=Math.floor((Date.now()-new Date(d).getTime())/60000); if(m<1)return"just now"; if(m<60)return`${m}m`; const h=Math.floor(m/60); if(h<24)return`${h}h`; return`${Math.floor(h/24)}d`; }

export default function ForumPage() {
  const [threads,setThreads]=useState<Thread[]>([]); const [loading,setLoading]=useState(true); const [cat,setCat]=useState("all"); const [search,setSearch]=useState(""); const [showNew,setShowNew]=useState(false); const [saving,setSaving]=useState(false); const [form,setForm]=useState({title:"",content:"",category:"general"});
  const [sel,setSel]=useState<ThreadDetail|null>(null); const [loadT,setLoadT]=useState(false); const [reply,setReply]=useState(""); const [sendR,setSendR]=useState(false);

  const fetch_ = useCallback(()=>{ setLoading(true); fetch(`/api/forum?category=${cat}`).then(r=>r.json()).then(d=>setThreads(d.threads||[])).catch(()=>toast.error("Failed")).finally(()=>setLoading(false)); },[cat]);
  useEffect(()=>{fetch_();},[fetch_]);

  const openT = async(id:string)=>{ setLoadT(true); try{ const r=await fetch(`/api/forum/${id}`); const d=await r.json(); if(r.ok)setSel(d); }catch{toast.error("Failed")} finally{setLoadT(false)} };
  const createT = async(e:React.FormEvent)=>{ e.preventDefault(); setSaving(true); try{ const r=await fetch("/api/forum",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); if(r.ok){toast.success("Posted!");setShowNew(false);setForm({title:"",content:"",category:"general"});fetch_();}else{const d=await r.json();toast.error(d.error||"Failed")} }catch{toast.error("Error")} finally{setSaving(false)} };
  const postR = async()=>{ if(!sel||!reply.trim())return; setSendR(true); try{ const r=await fetch(`/api/forum/${sel.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:reply.trim()})}); if(r.ok){setReply("");openT(sel.id);toast.success("Replied")} }catch{toast.error("Failed")} finally{setSendR(false)} };

  const filtered = threads.filter(t=>!search||t.title.toLowerCase().includes(search.toLowerCase()));

  if(sel) return (
    <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-300 px-4 sm:px-6 lg:px-0 pb-20">
      <button onClick={()=>setSel(null)} className="flex items-center gap-2 text-xs font-bold text-primary hover:underline py-2"><ArrowLeft className="w-4 h-4" /> Back</button>
      <div className="bg-white rounded-[1.5rem] border border-border/50 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold text-sm">{sel.author.name.charAt(0)}</div>
          <div className="flex-1"><h2 className="text-lg font-bold">{sel.title}</h2><div className="flex items-center gap-2 mt-1"><span className="text-xs font-semibold">{sel.author.name}</span><span className="text-[9px] bg-surface text-text-tertiary px-1.5 py-0.5 rounded">{sel.author.role}</span><span className="text-[10px] text-text-tertiary">· {timeAgo(sel.createdAt)}</span></div></div>
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${catClr[sel.category]||"bg-gray-50 text-gray-600"}`}>{sel.category}</span>
        </div>
        <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{sel.content}</p>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 text-[10px] text-text-tertiary"><span className="flex items-center gap-1"><Eye className="w-3 h-3" />{sel.views}</span><span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{sel.replies.length}</span></div>
      </div>
      <div className="space-y-2">{sel.replies.map(r=>(
        <div key={r.id} className="bg-white rounded-2xl border border-border/40 p-4 ml-6">
          <div className="flex items-center gap-2 mb-2"><div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-bold text-[10px]">{r.author.name.charAt(0)}</div><span className="text-xs font-bold">{r.author.name}</span><span className="text-[9px] bg-surface text-text-tertiary px-1.5 py-0.5 rounded">{r.author.role}</span><span className="text-[10px] text-text-tertiary ml-auto">{timeAgo(r.createdAt)}</span></div>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{r.content}</p>
        </div>
      ))}</div>
      {!sel.isLocked && <div className="bg-white rounded-2xl border border-border/50 p-4 flex gap-3 items-end sticky bottom-4"><textarea className="flex-1 bg-surface border border-border/40 rounded-xl px-4 py-3 text-sm resize-none min-h-[44px] max-h-32 font-medium" placeholder="Write a reply..." value={reply} onChange={e=>setReply(e.target.value)} rows={1} /><button onClick={postR} disabled={sendR||!reply.trim()} className="btn btn-primary !rounded-xl !py-3 !px-5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Send className="w-3.5 h-3.5" />Reply</button></div>}
    </div>
  );

  return (
    <div className="space-y-4">
      <ModulePageHeader
        icon={MessageSquare}
        title="Discussion Forum"
        description="Neighbourhood conversations, issue threads, and resident updates."
        meta={`${threads.length} discussions`}
        tone="violet"
        actions={
          <button onClick={()=>setShowNew(true)} className="btn btn-primary !rounded-xl px-6 py-2.5 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-primary/10"><Plus className="w-4 h-4" />New Discussion</button>
        }
      />
      <div className="rounded-[1.5rem] border border-border/60 bg-white p-3 shadow-sm sm:p-4 dark:bg-[#1E1E1E]">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" /><input className="input !rounded-xl !bg-surface/50 !border-border/60 !pl-11 w-full text-xs font-semibold" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">{cats.map(c=><button key={c.key} onClick={()=>setCat(c.key)} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${cat===c.key?"bg-primary text-white":"bg-surface text-text-secondary hover:bg-primary/5"}`}>{c.label}</button>)}</div>
      </div>
      </div>
      {loading||loadT?<div className="flex items-center justify-center py-20"><div className="spinner !w-8 !h-8" /></div>:filtered.length===0?<ModuleEmptyState icon={MessageSquare} title="No discussions yet" description="Start the first thread for this category." tone="violet" />:(
        <div className="space-y-2">{filtered.map(t=>(
          <button key={t.id} onClick={()=>openT(t.id)} className="w-full bg-white rounded-2xl border border-border/50 p-4 sm:p-5 text-left hover:shadow-sm hover:border-primary/20 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0">{t.author.name.charAt(0)}</div>
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2">{t.isPinned&&<Pin className="w-3 h-3 text-amber-500 shrink-0" />}<h4 className="text-sm font-bold truncate">{t.title}</h4></div><p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{t.content}</p>
              <div className="flex items-center gap-3 mt-2"><span className="text-[10px] font-semibold">{t.author.name}</span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${catClr[t.category]||"bg-gray-50"}`}>{t.category}</span><span className="text-[10px] text-text-tertiary flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(t.lastActivityAt)}</span></div></div>
              <div className="flex flex-col items-center gap-1 shrink-0 text-text-tertiary"><div className="flex items-center gap-1 text-[10px]"><MessageCircle className="w-3 h-3" />{t._count.replies}</div><div className="flex items-center gap-1 text-[10px]"><Eye className="w-3 h-3" />{t.views}</div></div>
            </div>
          </button>
        ))}</div>
      )}
      {showNew&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center" onClick={()=>setShowNew(false)}><div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border/30"><h3 className="text-lg font-bold">New Discussion</h3><button onClick={()=>setShowNew(false)} className="p-2 rounded-full hover:bg-surface"><X className="w-5 h-5" /></button></div>
        <form onSubmit={createT} className="p-5 space-y-4">
          <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 w-full" placeholder="Title *" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
          <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{cats.filter(c=>c.key!=="all").map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select>
          <textarea className="input !rounded-xl !bg-surface font-medium text-sm px-4 py-3.5 w-full min-h-[120px] resize-none" placeholder="What's on your mind? *" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} required />
          <div className="flex gap-3 pt-2"><button type="button" onClick={()=>setShowNew(false)} className="flex-1 btn btn-secondary !rounded-xl py-3.5 font-bold text-sm">Cancel</button><button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-3.5 font-bold text-sm shadow-xl shadow-primary/20">{saving?"Posting...":"Post"}</button></div>
        </form>
      </div></div>}
    </div>
  );
}
