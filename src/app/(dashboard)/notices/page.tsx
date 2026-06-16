"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/user-context";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { Plus, Pin, PinOff, Trash2, Megaphone, Bell, Calendar, User, Info, AlertTriangle, MessageCircle, X, ShieldCheck, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAppDialog } from "@/components/ui/AppDialogProvider";
import { ModuleEmptyState, ModulePageHeader } from "@/components/ux/ModulePageKit";
import {
  createNotice,
  deleteNotice as deleteNoticeApi,
  listNotices,
  updateNotice,
  type Notice,
} from "@/lib/api/notices";

const categoryStyles: Record<string, { bg: string, text: string, icon: LucideIcon }> = {
  general: { bg: "bg-blue-500/5", text: "text-blue-600", icon: Info },
  event: { bg: "bg-purple-500/5", text: "text-purple-600", icon: Bell },
  maintenance: { bg: "bg-orange-500/5", text: "text-orange-600", icon: AlertTriangle },
  emergency: { bg: "bg-red-500/5", text: "text-red-600", icon: Megaphone },
  meeting: { bg: "bg-emerald-500/5", text: "text-emerald-600", icon: MessageCircle },
};

export default function NoticesPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const { confirm } = useAppDialog();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useUser();
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "general",
    isPinned: false,
  });

  const isAdmin = user?.role === "chairman" || user?.role === "secretary" || user?.role === "treasurer";

  const fetchNotices = useCallback(() => {
    setLoading(true);
    listNotices()
      .then((loadedNotices) => setNotices(loadedNotices))
      .catch(() => toastT.error("Failed to load notices"))
      .finally(() => setLoading(false));
  }, [toastT]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createNotice(form);
      toastT.success("Notice broadcasted successfully");
      setShowForm(false);
      setForm({ title: "", body: "", category: "general", isPinned: false });
      fetchNotices();
    } catch {
      toastT.error("Failed to publish");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    try {
      await updateNotice(id, { isPinned: !isPinned });
      fetchNotices();
      toastT.success(isPinned ? "Notice unpinned" : "Notice pinned to top");
    } catch {
      toastT.error("Update failed");
    }
  };

  const deleteNotice = async (id: string) => {
    const ok = await confirm({
      title: t("Delete Notice"),
      message: t("Permanently delete this notice from the board?"),
      confirmLabel: t("Delete Notice"),
      danger: true,
    });
    if (!ok) return;
    await deleteNoticeApi(id);
    toastT.success("Notice retracted");
    fetchNotices();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={Megaphone}
        title={t("Broadcast Board")}
        description={t("Official announcements, maintenance updates, and society-wide alerts.")}
        meta={`${notices.length} ${t("active")}`}
        tone="primary"
        actions={isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold shadow-md shadow-primary/10 flex items-center transition-all hover:scale-[1.01] active:scale-[0.98]">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> {t("Publish Notice")}
          </button>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 items-start">
        <div className="lg:col-span-3 space-y-4">
           {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <div className="spinner !w-8 !h-8" />
               <p className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">{t("Syncing board...")}</p>
             </div>
           ) : notices.length === 0 ? (
             <ModuleEmptyState
               icon={Megaphone}
               title={t("No active notices")}
               description={t("Official society updates will appear here.")}
               tone="primary"
             />
           ) : (
             <div className="space-y-4">
                {notices.sort((a,b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1)).map((n) => {
                   const style = categoryStyles[n.category] || categoryStyles.general;
                   const Icon = style.icon;
                   
                   return (
                     <div key={n.id} className={`bg-white rounded-[1.25rem] border ${n.isPinned ? 'border-primary/10 bg-primary/5 border-l-4 border-l-primary' : 'border-border/60'} p-5 sm:p-6 transition-all hover:shadow-md hover:border-primary/20 group relative overflow-hidden`}>
                        <div className="flex items-start gap-4 sm:gap-5">
                           <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${style.bg} flex items-center justify-center ${style.text} shrink-0`}>
                              <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                 <h4 className="text-base sm:text-lg font-bold text-text-primary leading-tight tracking-tight">{n.title}</h4>
                                 {n.isPinned && (
                                   <span className="flex items-center gap-1 text-[9px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full border border-primary/10">
                                      <Pin className="w-2.5 h-2.5 rotate-45" /> {t("Pinned")}
                                   </span>
                                 )}
                                 <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.bg} ${style.text} border-transparent`}>
                                    {t(n.category.charAt(0).toUpperCase() + n.category.slice(1))}
                                 </span>
                              </div>
                              <p className="text-sm text-text-secondary leading-normal mb-6 whitespace-pre-wrap font-medium">
                                 {n.body}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-5 border-t border-border/40">
                                 <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-surface border border-border/50 flex items-center justify-center text-primary font-bold text-[9px]">
                                       {n.postedBy?.charAt(0)}
                                    </div>
                                    <span className="text-[10px] font-bold text-text-secondary uppercase">{n.postedBy}</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-text-tertiary">
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase">{new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                                 </div>
                              </div>
                           </div>
                           
                           {isAdmin && (
                             <div className="flex sm:flex-col lg:flex-row items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button onClick={() => togglePin(n.id, n.isPinned)} className="w-8 h-8 rounded-lg bg-surface border border-border/40 flex items-center justify-center text-text-tertiary hover:text-primary hover:border-primary transition-all shadow-sm" title={t("Pin notice")}>
                                   {n.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => deleteNotice(n.id)} className="w-8 h-8 rounded-lg bg-surface border border-border/40 flex items-center justify-center text-text-tertiary hover:text-danger hover:border-danger transition-all shadow-sm" title={t("Retract notice")}>
                                   <Trash2 className="w-3.5 h-3.5" />
                                </button>
                             </div>
                           )}
                        </div>
                     </div>
                   );
                })}
             </div>
           )}
        </div>

        <div className="space-y-6 hidden lg:block">
           <div className="card !p-5 bg-gradient-to-br from-indigo-700 to-primary text-white shadow-lg border-none">
              <h3 className="font-bold flex items-center gap-2 mb-4 text-[11px] uppercase tracking-[0.1em] text-white/70">
                 <Zap className="w-4 h-4" /> {t("Live Feed")}
              </h3>
              <p className="text-2xl font-bold tracking-tight mb-4">{notices.length} {t("Active Records")}</p>
              <div className="space-y-2">
                 <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium">{t("Verify guest passes today")}</span>
                 </div>
              </div>
           </div>

           <div className="p-5 rounded-2xl bg-surface border border-border/40">
              <h3 className="font-bold text-[10px] text-text-tertiary uppercase tracking-widest mb-4">{t("Board Policies")}</h3>
              <ul className="space-y-3">
                 {[
                    { text: "Verified member access only", icon: ShieldCheck },
                    { text: "Call ext 99 for emergencies", icon: User },
                    { text: "Archived after 30 days", icon: Calendar },
                 ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                       <item.icon className="w-3.5 h-3.5 text-text-tertiary" /> {t(item.text)}
                    </li>
                 ))}
              </ul>
           </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-2xl sm:rounded-[2rem] !p-6 sm:!p-10 shadow-2xl h-full sm:h-auto overflow-y-auto animate-in slide-in-from-bottom-5 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white">
                     <Megaphone className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-xl font-bold text-text-primary tracking-tight">{t("Post Announcement")}</h3>
                     <p className="text-xs font-medium text-text-secondary mt-0.5">{t("Reach all society members")}</p>
                  </div>
               </div>
               <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Title *")}</label>
                <input className="input !rounded-xl !bg-surface font-bold text-base py-5 px-5" placeholder={t("e.g. Lift inspection wing B")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Details *")}</label>
                <textarea className="input !rounded-2xl !bg-surface !h-auto min-h-[150px] font-medium resize-none text-sm leading-relaxed p-5" placeholder={t("Provide full details here...")} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Category")}</label>
                    <select className="select !rounded-xl !bg-surface font-bold py-3 px-4" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                       <option value="general">{t("Update")}</option>
                       <option value="event">{t("Event")}</option>
                       <option value="maintenance">{t("Maintenance")}</option>
                       <option value="emergency">{t("Emergency")}</option>
                       <option value="meeting">{t("Meeting")}</option>
                    </select>
                 </div>
                 <button type="button" onClick={() => setForm(f => ({ ...f, isPinned: !f.isPinned }))} className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${form.isPinned ? 'border-primary bg-primary/5 text-primary' : 'border-border/40 text-text-tertiary hover:border-primary/20 bg-surface/50'}`}>
                    <span className="font-bold text-xs uppercase tracking-wider">{t("Pin to top")}</span>
                    {form.isPinned ? <Pin className="w-5 h-5" /> : <PinOff className="w-5 h-5" />}
                 </button>
              </div>

              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white sm:static">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">{t("Cancel")}</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">
                  {saving ? t("Publishing...") : t("Broadcast Notice")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
