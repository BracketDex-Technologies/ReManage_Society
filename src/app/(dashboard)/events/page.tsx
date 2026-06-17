"use client";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/user-context";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { Calendar, Plus, MapPin, Users, Clock, CheckCircle, X, XCircle } from "lucide-react";
import { ModuleEmptyState, ModulePageHeader, ModuleSectionTitle } from "@/components/ux/ModulePageKit";
import { canUseResidentSelfService, isCommitteeRole } from "@/lib/roles";

interface SEvent { id:string; title:string; description:string|null; startDate:string; endDate:string|null; venue:string|null; category:string; maxAttendees:number|null; status:string; createdAt:string; organizer:{name:string;role:string}; _count:{rsvps:number}; }

const catColors:Record<string,string> = { general:"bg-blue-50 text-blue-600", festival:"bg-amber-50 text-amber-600", meeting:"bg-violet-50 text-violet-600", sports:"bg-emerald-50 text-emerald-600", cultural:"bg-pink-50 text-pink-600", maintenance:"bg-gray-50 text-gray-600" };

export default function EventsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const { user } = useUser();
  const canRsvp = canUseResidentSelfService(user?.role);
  const isCommittee = isCommitteeRole(user?.role);
  const [events,setEvents]=useState<SEvent[]>([]); const [loading,setLoading]=useState(true); const [showNew,setShowNew]=useState(false); const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({title:"",description:"",startDate:"",endDate:"",venue:"",category:"general",maxAttendees:""});

  const fetch_ = useCallback(()=>{ setLoading(true); fetch("/api/events").then(r=>r.json()).then(d=>setEvents(Array.isArray(d)?d:[])).catch(()=>toastT.error("Failed")).finally(()=>setLoading(false)); },[toastT]);
  useEffect(()=>{fetch_()},[fetch_]);

  const create = async(e:React.FormEvent)=>{ e.preventDefault(); setSaving(true); try{ const r=await fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); if(r.ok){toastT.success("Event created!");setShowNew(false);setForm({title:"",description:"",startDate:"",endDate:"",venue:"",category:"general",maxAttendees:""});fetch_();}else{const d=await r.json();toastT.error(d.error||"Failed")} }catch{toastT.error("Error")} finally{setSaving(false)} };

  const rsvp = async(eventId:string, response:string)=>{ try{ const r=await fetch("/api/events",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,response})}); if(r.ok){toastT.success(response==="attending"?t("RSVP confirmed"):t("RSVP updated"));fetch_();}else{const d=await r.json();toastT.error(d.error||"Failed")} }catch{toastT.error("Error")} };

  const fmt = (d:string) => new Date(d).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
  const fmtTime = (d:string) => new Date(d).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});

  const upcoming = events.filter(e=>new Date(e.startDate)>=new Date()).sort((a,b)=>new Date(a.startDate).getTime()-new Date(b.startDate).getTime());
  const past = events.filter(e=>new Date(e.startDate)<new Date()).sort((a,b)=>new Date(b.startDate).getTime()-new Date(a.startDate).getTime());

  const categoryLabel = (cat: string) => t(cat.charAt(0).toUpperCase() + cat.slice(1));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={Calendar}
        title={t("Events & Calendar")}
        description={t("Plan society programs, view schedules, and manage RSVPs.")}
        meta={`${events.length} ${t("events")}`}
        tone="emerald"
        actions={
          isCommittee ? (
          <button onClick={()=>setShowNew(true)} className="btn btn-primary !rounded-xl px-6 py-2.5 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-primary/10"><Plus className="w-4 h-4" />{t("Create Event")}</button>
          ) : undefined
        }
      />

      {loading?<div className="flex items-center justify-center py-20"><div className="spinner !w-8 !h-8" /></div>:events.length===0?(
        <ModuleEmptyState icon={Calendar} title={t("No events scheduled")} description={t("Create your first society event to open RSVPs.")} tone="emerald" />
      ):(
        <div className="space-y-6">
          {upcoming.length>0&&<div className="space-y-3">
            <ModuleSectionTitle title={t("Upcoming")} description={t("Confirmed and open event slots.")} />
            <div className="space-y-3">{upcoming.map(ev=>(
              <div key={ev.id} className="bg-white rounded-[1.5rem] border border-border/50 overflow-hidden hover:shadow-md transition-all">
                <div className="flex">
                  <div className="w-20 sm:w-24 bg-primary/5 flex flex-col items-center justify-center p-3 border-r border-border/30">
                    <span className="text-2xl sm:text-3xl font-bold text-primary">{new Date(ev.startDate).getDate()}</span>
                    <span className="text-[9px] font-bold text-primary/70 uppercase">{new Date(ev.startDate).toLocaleDateString("en-IN",{month:"short"})}</span>
                    <span className="text-[9px] text-text-tertiary mt-0.5">{new Date(ev.startDate).toLocaleDateString("en-IN",{weekday:"short"})}</span>
                  </div>
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2"><h3 className="text-sm sm:text-base font-bold">{ev.title}</h3><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${catColors[ev.category]||"bg-gray-50 text-gray-600"}`}>{categoryLabel(ev.category)}</span></div>
                        {ev.description&&<p className="text-xs text-text-secondary mt-1 line-clamp-2">{ev.description}</p>}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-text-tertiary">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(ev.startDate)}{ev.endDate?` - ${fmtTime(ev.endDate)}`:""}</span>
                          {ev.venue&&<span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.venue}</span>}
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ev._count.rsvps}{ev.maxAttendees?`/${ev.maxAttendees}`:""} {t("attending")}</span>
                        </div>
                      </div>
                    </div>
                    {canRsvp && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={()=>rsvp(ev.id,"attending")} className="btn btn-primary !rounded-xl !py-2 !px-4 text-[10px] font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t("Attending")}</button>
                      <button onClick={()=>rsvp(ev.id,"maybe")} className="btn btn-secondary !rounded-xl !py-2 !px-3 text-[10px] font-bold">{t("Maybe")}</button>
                      <button onClick={()=>rsvp(ev.id,"declined")} className="btn btn-secondary !rounded-xl !py-2 !px-3 text-[10px] font-bold flex items-center gap-1"><XCircle className="w-3 h-3" />{t("Can't go")}</button>
                    </div>
                    )}
                  </div>
                </div>
              </div>
            ))}</div>
          </div>}
          {past.length>0&&<div className="space-y-3">
            <ModuleSectionTitle title={t("Past Events")} description={t("Recently completed society programs.")} />
            <div className="space-y-2">{past.map(ev=>(
              <div key={ev.id} className="bg-surface/50 rounded-xl p-4 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-3"><span className="text-xs font-bold text-text-primary">{ev.title}</span><span className="text-[10px] text-text-tertiary">{fmt(ev.startDate)}</span></div>
                <span className="text-[10px] text-text-tertiary">{ev._count.rsvps} {t("attended")}</span>
              </div>
            ))}</div>
          </div>}
        </div>
      )}

      {showNew&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center" onClick={()=>setShowNew(false)}><div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border/30"><h3 className="text-lg font-bold">{t("Create Event")}</h3><button onClick={()=>setShowNew(false)} className="p-2 rounded-full hover:bg-surface"><X className="w-5 h-5" /></button></div>
        <form onSubmit={create} className="p-5 space-y-4">
          <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 w-full" placeholder={t("Event title *")} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
          <textarea className="input !rounded-xl !bg-surface font-medium text-sm px-4 py-3 w-full min-h-[80px] resize-none" placeholder={t("Description")} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Start *")}</label><input type="datetime-local" className="input !rounded-xl !bg-surface font-bold text-xs px-3 py-3 w-full" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} required /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("End")}</label><input type="datetime-local" className="input !rounded-xl !bg-surface font-bold text-xs px-3 py-3 w-full" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3 w-full" placeholder={t("Venue")} value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})} />
            <select className="select !rounded-xl !bg-surface font-bold text-sm py-3 px-4 w-full" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="general">{t("General")}</option><option value="festival">{t("Festival")}</option><option value="meeting">{t("Meeting")}</option><option value="sports">{t("Sports")}</option><option value="cultural">{t("Cultural")}</option><option value="maintenance">{t("Maintenance")}</option></select>
          </div>
          <input type="number" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3 w-full" placeholder={t("Max attendees (optional)")} value={form.maxAttendees} onChange={e=>setForm({...form,maxAttendees:e.target.value})} />
          <div className="flex gap-3 pt-2"><button type="button" onClick={()=>setShowNew(false)} className="flex-1 btn btn-secondary !rounded-xl py-3.5 font-bold text-sm">{t("Cancel")}</button><button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-3.5 font-bold text-sm shadow-xl shadow-primary/20">{saving?t("Creating..."):t("Create Event")}</button></div>
        </form>
      </div></div>}
    </div>
  );
}
