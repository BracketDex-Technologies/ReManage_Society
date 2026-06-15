"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { UserCheck, Clock, Plus, Calendar, ShieldCheck, X, Phone, User, CheckCircle2, XCircle, Bell, ArrowDownLeft, ArrowUpRight, History, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { LIVE_FAST_INTERVAL_MS } from "@/lib/live-refresh";
import NotifyAdminButton from "@/components/ux/NotifyAdminButton";

interface Visitor {
  id: string;
  visitorName: string;
  phone: string | null;
  purpose: string;
  status: string;
  isPreApproved: boolean;
  expectedAt: string | null;
  entryTime: string | null;
  exitTime: string | null;
  residentResponse: string | null;
  approvedBy: string | null;
  flatNumber: string;
  createdAt: string;
}

const purposeStyles: Record<string, { bg: string, text: string }> = {
  delivery: { bg: "bg-orange-500/5", text: "text-orange-600" },
  guest: { bg: "bg-blue-500/5", text: "text-blue-600" },
  service: { bg: "bg-purple-500/5", text: "text-purple-600" },
  cab: { bg: "bg-emerald-500/5", text: "text-emerald-600" },
  other: { bg: "bg-gray-500/5", text: "text-gray-600" },
};

export default function MyVisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [noFlatLinked, setNoFlatLinked] = useState(false);
  const [form, setForm] = useState({
    visitorName: "",
    phone: "",
    purpose: "guest",
    expectedAt: new Date().toISOString().slice(0, 16),
  });

  const fetchVisitors = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch(`/api/my-visitors${showHistory ? "?history=all" : ""}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (data.noFlatLinked) {
        setVisitors([]);
        setNoFlatLinked(true);
        return;
      }
      setNoFlatLinked(false);
      if (data.visitors) {
        setVisitors(data.visitors);
      }
    } catch {
      if (!isBackground) toast.error("Failed to load visitors");
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [showHistory]);

  useEffect(() => {
    fetchVisitors();
    const refresh = () => fetchVisitors(true);
    const interval = window.setInterval(refresh, LIVE_FAST_INTERVAL_MS);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [fetchVisitors]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const approve = params.get("approve");
    if (approve) {
      setHighlightId(approve);
    }
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.visitorName || !form.expectedAt) {
      toast.error("Name and expected time are required");
      return;
    }

    setSaving(true);
    const load = toast.loading("Issuing pre-approval...");
    try {
      const res = await fetch("/api/my-visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Visitor pre-approved successfully", { id: load });
        setShowForm(false);
        setForm({ visitorName: "", phone: "", purpose: "guest", expectedAt: new Date().toISOString().slice(0, 16) });
        fetchVisitors();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to add", { id: load });
      }
    } catch {
      toast.error("Something went wrong", { id: load });
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "--";
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (value?: string | null) => {
    if (!value) return "--";
    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const visitDuration = (entry?: string | null, exit?: string | null) => {
    if (!entry || !exit) return "";
    const minutes = Math.max(0, Math.round((new Date(exit).getTime() - new Date(entry).getTime()) / 60000));
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const statusLabel = (visitor: Visitor) => {
    if (visitor.status === "expected" && !visitor.residentResponse && !visitor.isPreApproved) return "Waiting at gate";
    if (visitor.status === "expected" && visitor.residentResponse === "approved") return visitor.isPreApproved ? "Pre-approved" : "Approved for entry";
    if (visitor.status === "in") return "Inside premise";
    if (visitor.status === "out") return "Visit completed";
    if (visitor.status === "rejected") return "Rejected";
    return visitor.status;
  };

  const handleApproval = async (visitorId: string, action: "approved" | "rejected") => {
    setActionLoading(visitorId);
    try {
      const res = await fetch("/api/my-visitors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || (action === "approved" ? "Visitor approved" : "Visitor rejected"));
        fetchVisitors();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      {/* Header - Synchronized Clean Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/5 font-bold">
            <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-none sm:leading-normal">Expected Guests</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium italic sm:not-italic">Pre-approve visitors for faster entry</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary !rounded-xl px-6 sm:px-8 py-2.5 sm:py-3 font-bold text-sm shadow-md shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center shrink-0">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Pre-approve Guest
        </button>
      </div>

      {noFlatLinked && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-950 dark:text-amber-100">Flat not linked yet</p>
                <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
                  Visitor records need your flat assigned. Notify the committee admin with one tap.
                </p>
              </div>
            </div>
            <NotifyAdminButton category="flat_link" className="w-full sm:w-auto shrink-0" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 items-start">
        {/* Main List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
                <Clock className="w-5 h-5 text-text-tertiary" /> Personal Log
             </h3>
             <button onClick={() => setShowHistory((value) => !value)} className="btn btn-secondary btn-sm !rounded-xl text-xs font-bold">
               <History className="w-4 h-4" />
               {showHistory ? "Recent" : "Full History"}
             </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="spinner !w-8 !h-8" />
              <p className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">Syncing records...</p>
            </div>
          ) : visitors.length === 0 ? (
            <div className="card text-center py-24 bg-surface/30 border-dashed border-2">
              <Calendar className="w-12 h-12 text-text-tertiary mx-auto mb-4 opacity-20" />
              <p className="text-text-primary font-bold">
                {noFlatLinked ? "Waiting for flat assignment" : "No visitor records."}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                {noFlatLinked
                  ? "Once your flat is linked, gate entries and pre-approved guests will appear here."
                  : "Gate entries and pre-approved guests will appear here."}
              </p>
              {noFlatLinked && (
                <div className="mt-4 flex justify-center">
                  <NotifyAdminButton category="flat_link" variant="secondary" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
               {visitors.map((v) => {
                  const style = purposeStyles[v.purpose] || purposeStyles.other;
                  const needsApproval = v.status === "expected" && !v.residentResponse && !v.isPreApproved;
                  return (
                    <div key={v.id} className={`bg-white rounded-[1.25rem] border p-5 sm:p-6 transition-all hover:shadow-md group relative overflow-hidden ${highlightId === v.id || needsApproval ? "border-amber-300 shadow-sm shadow-amber-100" : "border-border/60 hover:border-primary/20"}`}>
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                          <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                             <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center ${style.text} shrink-0`}>
                                <User className="w-6 h-6" />
                             </div>
                             <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                   <h4 className="text-base sm:text-lg font-bold text-text-primary tracking-tight leading-tight">{v.visitorName}</h4>
                                   <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
                                      {v.purpose}
                                   </span>
                                   {needsApproval && (
                                     <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 flex items-center gap-1">
                                       <Bell className="w-3 h-3" /> Approval needed
                                     </span>
                                   )}
                                </div>
                                <div className="flex items-center gap-4">
                                   <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary uppercase">
                                      <Clock className="w-3 h-3 text-text-tertiary" />
                                      {statusLabel(v)}
                                   </div>
                                   {v.phone && (
                                     <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                                        <Phone className="w-3 h-3 text-text-tertiary" />
                                        {v.phone}
                                     </div>
                                   )}
                                </div>
                             </div>
                          </div>

                          {needsApproval ? (
                            <div className="flex items-center gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/40">
                              <button
                                onClick={() => handleApproval(v.id, "approved")}
                                disabled={actionLoading === v.id}
                                className="btn bg-emerald-600 text-white !rounded-xl !py-2.5 !px-4 text-xs font-bold"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproval(v.id, "rejected")}
                                disabled={actionLoading === v.id}
                                className="btn bg-red-600 text-white !rounded-xl !py-2.5 !px-4 text-xs font-bold"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            </div>
                         ) : (
                          <div className="flex flex-col gap-1 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/40 text-right min-w-[160px]">
                             {!v.entryTime ? (
                               <p className="text-[10px] font-semibold text-text-secondary flex items-center justify-end gap-1">
                                 <Calendar className="w-3 h-3" />
                                 {v.expectedAt ? `Expected ${formatDateTime(v.expectedAt)}` : `Requested ${formatDateTime(v.createdAt)}`}
                               </p>
                             ) : (
                               <p className="text-[10px] font-semibold text-text-secondary flex items-center justify-end gap-1">
                                 <ArrowDownLeft className="w-3 h-3" />
                                 In {formatDateTime(v.entryTime)}
                               </p>
                             )}
                             {v.exitTime && (
                               <p className="text-[10px] font-semibold text-text-secondary flex items-center justify-end gap-1">
                                 <ArrowUpRight className="w-3 h-3" />
                                 Out {formatTime(v.exitTime)}
                               </p>
                             )}
                             {v.exitTime && (
                               <p className="text-[10px] font-bold text-primary">
                                 Duration {visitDuration(v.entryTime, v.exitTime)}
                               </p>
                             )}
                          </div>
                          )}
                       </div>
                    </div>
                  );
               })}
            </div>
          )}
        </div>

        {/* Info Column */}
        <div className="space-y-6 hidden lg:block">
           <div className="p-5 rounded-2xl bg-surface border border-border/40">
              <h3 className="font-bold text-[10px] text-text-tertiary uppercase tracking-widest mb-4">Pro-Tips</h3>
              <ul className="space-y-3">
                 {[
                    { text: "Saves 2 mins at the gate", icon: Clock },
                    { text: "Identity verified by security", icon: ShieldCheck },
                    { text: "Works for 24 hours", icon: UserCheck },
                 ].map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                       <t.icon className="w-3.5 h-3.5 text-text-tertiary" /> {t.text}
                    </li>
                 ))}
              </ul>
           </div>
        </div>
      </div>

      {/* Pre-approval Modal - Mobile Optimized */}
      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-xl sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                     <Plus className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-xl font-bold text-text-primary tracking-tight">Access Token</h3>
                     <p className="text-xs font-medium text-text-secondary mt-0.5">Smooth entry for your guests</p>
                  </div>
               </div>
               <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleAdd} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Guest Name *</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="John Doe" value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Guest Contact</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="+91 XXXX XXXX" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Purpose</label>
                  <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                    <option value="guest">Guest / Relative</option>
                    <option value="delivery">Delivery</option>
                    <option value="service">Service / Repair</option>
                    <option value="cab">Cab / Taxi</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Expected Time *</label>
                  <input type="datetime-local" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3" value={form.expectedAt} onChange={(e) => setForm({ ...form, expectedAt: e.target.value })} required />
                </div>
              </div>

              <div className="flex gap-3 pt-6 sticky bottom-0 bg-white sm:static">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">
                  {saving ? "Issuing..." : "Confirm Pass"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
