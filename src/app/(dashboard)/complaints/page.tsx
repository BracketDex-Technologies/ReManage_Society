"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useUser } from "@/lib/user-context";
import toast from "react-hot-toast";
import { Plus, AlertTriangle, CheckCircle2, Clock, Share2, MessageSquare, Info, ShieldAlert, Calendar, X, Scale, Phone } from "lucide-react";
import { canRaiseComplaint, isCommitteeRole } from "@/lib/roles";
import { ModuleEmptyState, ModulePageHeader, ModuleStatCard } from "@/components/ux/ModulePageKit";

interface Complaint {
  id: string;
  flatNumber: string;
  raisedBy: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface Stats {
  open: number;
  inProgress: number;
  resolved: number;
  total: number;
}

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700 font-bold",
  urgent: "bg-red-100 text-red-700 font-black",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-red-50 text-red-600 border-red-200" },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-600 border-amber-200" },
  resolved: { label: "Resolved", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  closed: { label: "Closed", color: "bg-gray-50 text-gray-600 border-gray-200" },
};

const categories = ["general", "plumbing", "electrical", "cleanliness", "security", "parking"];

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [resolveComplaint, setResolveComplaint] = useState<Complaint | null>(null);
  const [resolution, setResolution] = useState("");
  const [societyId, setSocietyId] = useState("");
  const [legalAdviserName, setLegalAdviserName] = useState<string | null>(null);
  const [legalAdviserPhone, setLegalAdviserPhone] = useState<string | null>(null);
  const [legalEscalation, setLegalEscalation] = useState(false);
  const legalEscalationInitialized = useRef(false);
  const { user } = useUser();

  const [form, setForm] = useState({
    flatNumber: "",
    raisedBy: "",
    title: "",
    description: "",
    category: "general",
    priority: "medium",
  });

  const isAdmin = isCommitteeRole(user?.role);
  const showRaiseComplaint = canRaiseComplaint(user?.role);

  const fetchComplaints = useCallback(() => {
    setLoading(true);
    fetch("/api/complaints")
      .then((r) => r.json())
      .then((d) => {
        setComplaints(d.complaints || []);
        setStats(d.stats || { open: 0, inProgress: 0, resolved: 0, total: 0 });
        if (d.societyId) setSocietyId(d.societyId);
        setLegalAdviserName(d.legalAdviserName ?? null);
        setLegalAdviserPhone(d.legalAdviserPhone ?? null);
      })
      .catch(() => toast.error("Failed to load complaints"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  useEffect(() => {
    if (legalEscalationInitialized.current || isAdmin) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("escalate") !== "legal") return;

    legalEscalationInitialized.current = true;
    setLegalEscalation(true);
    setShowForm(true);
    setStatusFilter("open");
    setForm((prev) => ({
      ...prev,
      priority: "high",
      category: "security",
      title: prev.title || "Legal escalation — unresolved complaint",
      description:
        prev.description ||
        "I am requesting legal escalation for an unresolved society issue.\n\nExisting complaint ID / date (if any):\n\nIssue summary:\n\nAction requested:",
    }));
  }, [isAdmin]);

  useEffect(() => {
    if (user.name || user.flatNumber) {
      setForm(prev => ({
        ...prev,
        flatNumber: user.flatNumber || "",
        raisedBy: user.name || ""
      }));
    }
  }, [user.name, user.flatNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Complaint registered successfully");
        setShowForm(false);
        setForm({ 
          flatNumber: user?.flatNumber || "", 
          raisedBy: user?.name || "", 
          title: "", 
          description: "", 
          category: "general", 
          priority: "medium" 
        });
        fetchComplaints();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to submit");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string, res?: string) => {
    try {
       toast.loading("Updating status...", { id: "stat-upd" });
      const response = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution: res }),
      });
      if (response.ok) {
        toast.success(`Complaint ${status === "resolved" ? "resolved" : "updated"}`, { id: "stat-upd" });
        fetchComplaints();
      }
    } catch {
      toast.error("Failed to update", { id: "stat-upd" });
    }
    setResolveComplaint(null);
    setResolution("");
  };

  const filtered = statusFilter === "all"
    ? complaints
    : complaints.filter((c) => c.status === statusFilter);

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={MessageSquare}
        title="Help Desk"
        description="Track complaints, ownership, urgency, and resolution progress."
        meta={`${stats.total} tickets`}
        tone="amber"
        actions={
          <>
          {isAdmin && societyId && (
            <button 
              onClick={() => {
                const link = `${window.location.origin}/complaint/submit?sId=${societyId}`;
                navigator.clipboard.writeText(link);
                toast.success("Shareable form copied!");
              }}
              className="btn btn-secondary !rounded-xl px-4 sm:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center shrink-0"
            >
              <Share2 className="w-4 h-4 mr-2" /> Share Form
            </button>
          )}
          {showRaiseComplaint && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.98] shrink-0">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Raise Complaint
          </button>
          )}
          </>
        }
      />

      {legalEscalation && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-red-900 text-sm sm:text-base">Legal escalation workflow</h2>
              <p className="text-xs sm:text-sm text-red-800/90 mt-1 leading-relaxed">
                Log or reference your unresolved complaint below. The committee reviews open tickets first;
                persistent defaulters or rule violations may be referred to the society legal adviser.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {legalAdviserPhone ? (
              <a
                href={`tel:${legalAdviserPhone.replace(/\s/g, "")}`}
                className="btn btn-primary btn-sm flex items-center gap-2 !bg-red-700 hover:!bg-red-800"
              >
                <Phone className="w-4 h-4" />
                Call {legalAdviserName || "Legal Adviser"}
              </a>
            ) : (
              <span className="text-xs text-red-700/80 font-medium px-1">
                Legal adviser contact not configured — committee will coordinate escalation.
              </span>
            )}
            <Link href="/complaints" className="btn btn-secondary btn-sm flex items-center gap-2">
              Dismiss
            </Link>
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <ModuleStatCard icon={AlertTriangle} label="Open" value={stats.open} tone="red" />
          <ModuleStatCard icon={Clock} label="In Progress" value={stats.inProgress} tone="amber" />
          <ModuleStatCard icon={CheckCircle2} label="Resolved" value={stats.resolved} tone="emerald" />
          <ModuleStatCard icon={Info} label="Total" value={stats.total} tone="primary" />
        </div>
      ) : (
        <div className="bg-indigo-50/50 p-5 sm:p-6 rounded-2xl border border-indigo-100 flex items-center gap-4">
           <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm shrink-0 border border-indigo-50">
              <Info className="w-5 h-5" />
           </div>
           <div>
              <p className="text-xs sm:text-sm font-bold text-text-primary">Need immediate assistance?</p>
              <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5 leading-tight">Security Command: <strong>Dial 99</strong> from your intercom.</p>
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
             <h3 className="text-base sm:text-lg font-bold text-text-primary">
                {isAdmin ? "Society Queue" : "My Logged Trackers"}
             </h3>
             <div className="h-4 w-px bg-border hidden sm:block" />
             <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                {["all", "open", "in_progress", "resolved"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all shrink-0 ${
                      statusFilter === s ? "bg-primary text-white" : "bg-white border border-border/60 text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    {s === "all" ? "All" : s.replace("_", " ")}
                  </button>
                ))}
             </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="spinner !w-8 !h-8" />
            <p className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">Fetching logs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <ModuleEmptyState
            icon={CheckCircle2}
            title="Queue is clear"
            description={`No matching ${statusFilter !== "all" ? statusFilter.replace("_", " ") : ""} complaints in the system.`}
            tone="emerald"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white rounded-[1.25rem] border border-border/60 p-5 sm:p-6 transition-all hover:shadow-md hover:border-primary/20 group relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${statusConfig[c.status]?.color || "bg-gray-100 text-gray-600 border-transparent"}`}>
                        {statusConfig[c.status]?.label || c.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${priorityColors[c.priority] || priorityColors.medium}`}>
                        {c.priority}
                      </span>
                      <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider bg-surface px-2 py-0.5 rounded-full border border-border/30">{c.category}</span>
                    </div>
                    
                    <h4 className="text-base sm:text-lg font-bold text-text-primary tracking-tight leading-tight mb-2">{c.title}</h4>
                    <p className="text-sm text-text-secondary leading-normal mb-8 font-medium">
                       {c.description}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-5 border-t border-border/40">
                      <div className="flex items-center gap-2">
                         <div className="w-7 h-7 rounded-full bg-surface border border-border/50 flex items-center justify-center text-primary font-black text-[9px]">{c.flatNumber?.charAt(0)}</div>
                         <div>
                            <p className="text-[8px] font-bold text-text-tertiary uppercase leading-none mb-1">Author</p>
                            <p className="text-[11px] font-bold text-text-primary leading-none">{c.raisedBy} · Flat {c.flatNumber}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Calendar className="w-3.5 h-3.5 text-text-tertiary" />
                         <div>
                            <p className="text-[8px] font-bold text-text-tertiary uppercase leading-none mb-1">Recorded</p>
                            <p className="text-[11px] font-bold text-text-primary leading-none">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                         </div>
                      </div>
                      {c.resolution && (
                        <div className="flex items-center gap-3 bg-emerald-50/70 py-1.5 px-3 rounded-lg border border-emerald-100/50">
                           <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                           <p className="text-[11px] text-emerald-700 font-semibold tracking-tight"><strong>Resolved:</strong> {c.resolution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isAdmin && (c.status === "open" || c.status === "in_progress") && (
                    <div className="flex md:flex-col gap-2 shrink-0 md:pl-6 md:border-l border-border/40 sm:pt-4 md:pt-0">
                      {c.status === "open" && (
                        <button
                          onClick={() => updateStatus(c.id, "in_progress")}
                          className="btn btn-secondary !rounded-xl py-2.5 sm:py-3 px-6 text-xs font-bold leading-none hover:bg-amber-50"
                        >
                           Track Now
                        </button>
                      )}
                      <button
                        onClick={() => setResolveComplaint(c)}
                        className="btn btn-primary !bg-emerald-600 hover:!bg-emerald-700 !rounded-xl py-2.5 sm:py-3 px-6 text-xs font-bold leading-none shadow-md shadow-emerald-100/50"
                      >
                         Mark Fixed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Complaint Modal - Mobile Optimized */}
      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-xl sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in slide-in-from-bottom-6 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                     <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-xl font-bold text-text-primary tracking-tight">Raise Alert</h3>
                     <p className="text-xs font-medium text-text-secondary mt-0.5">Let us improve the society together</p>
                  </div>
               </div>
               <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pb-20 sm:pb-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Flat *</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 disabled:opacity-50" placeholder="A-101" value={form.flatNumber} onChange={(e) => setForm({ ...form, flatNumber: e.target.value })} disabled={!isAdmin && !!user?.flatNumber} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Requester *</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 disabled:opacity-50" placeholder="Full Name" value={form.raisedBy} onChange={(e) => setForm({ ...form, raisedBy: e.target.value })} disabled={!isAdmin && !!user?.name} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Issue Title *</label>
                <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Short summary" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Description *</label>
                <textarea className="input !rounded-2xl !bg-surface !h-auto min-h-[120px] font-medium resize-none text-sm p-4 px-5" placeholder="Detailed breakdown of the issue..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Category</label>
                  <select className="select !rounded-xl !bg-surface font-bold py-3.5 px-4" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {categories.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Urgency</label>
                  <select className="select !rounded-xl !bg-surface font-bold py-3.5 px-4" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Standard</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6 sticky bottom-0 bg-white sm:static">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Discard</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">
                  {saving ? "Sending..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Modal - Mobile Optimized */}
      {resolveComplaint && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-md z-[100]" onClick={() => setResolveComplaint(null)}>
          <div className="bg-white w-full max-w-lg sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-bold text-text-primary tracking-tight">Resolution Report</h3>
               <button onClick={() => setResolveComplaint(null)} className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-6">
               <div className="p-4 rounded-xl bg-surface border border-border/40 text-xs text-text-secondary">
                  <strong>Issue:</strong> {resolveComplaint.title}
               </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Action Notes *</label>
                <textarea
                  className="input !rounded-2xl !bg-surface !h-auto min-h-[140px] font-medium p-4 text-sm"
                  placeholder="Steps taken to fix this..."
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button onClick={() => setResolveComplaint(null)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Cancel</button>
                <button
                  onClick={() => updateStatus(resolveComplaint.id, "resolved", resolution)}
                  disabled={!resolution.trim()}
                  className="flex-[2] btn btn-primary !bg-emerald-600 hover:!bg-emerald-700 !rounded-xl py-4 font-bold text-sm shadow-xl shadow-emerald-100/50"
                >
                  Verify Fix
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
