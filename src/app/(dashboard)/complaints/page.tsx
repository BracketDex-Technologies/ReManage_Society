"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useUser } from "@/lib/user-context";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Share2,
  MessageSquare,
  Info,
  ShieldAlert,
  Calendar,
  X,
  Scale,
  Phone,
  Star,
  RotateCcw,
} from "lucide-react";
import { canRaiseComplaint, isCommitteeRole } from "@/lib/roles";
import { ModuleEmptyState, ModulePageHeader, ModuleSectionTitle, ModuleStatCard } from "@/components/ux/ModulePageKit";
import { isComplaintHistory } from "@/lib/history-utils";
import { StarRating } from "@/components/complaints/StarRating";
import { ComplaintProgress } from "@/components/complaints/ComplaintProgress";
import {
  COMPLAINT_CATEGORIES,
  categoryConfig,
  priorityColors,
  priorityLabels,
  statusConfig,
  type ComplaintCategory,
} from "@/components/complaints/complaint-config";

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
  satisfactionRating: number | null;
  satisfactionComment: string | null;
  createdAt: string;
}

interface Stats {
  open: number;
  inProgress: number;
  resolved: number;
  pendingRating?: number;
  avgRating?: number | null;
  total: number;
}

const emptyStateDescriptions: Record<string, string> = {
  all: "No matching complaints in the system.",
  open: "No matching open complaints in the system.",
  in_progress: "No matching in progress complaints in the system.",
  resolved: "No matching resolved complaints in the system.",
};

const filterStatuses = ["all", "open", "in_progress", "resolved"] as const;

export default function ComplaintsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [resolveComplaint, setResolveComplaint] = useState<Complaint | null>(null);
  const [rateComplaint, setRateComplaint] = useState<Complaint | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);
  const [resolution, setResolution] = useState("");
  const [societyId, setSocietyId] = useState("");
  const [legalAdviserName, setLegalAdviserName] = useState<string | null>(null);
  const [legalAdviserPhone, setLegalAdviserPhone] = useState<string | null>(null);
  const [noFlatLinked, setNoFlatLinked] = useState(false);
  const [legalEscalation, setLegalEscalation] = useState(false);
  const legalEscalationInitialized = useRef(false);
  const { user } = useUser();

  const [form, setForm] = useState({
    flatNumber: "",
    raisedBy: "",
    title: "",
    description: "",
    category: "general" as ComplaintCategory,
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
        setNoFlatLinked(Boolean(d.noFlatLinked));
      })
      .catch(() => toastT.error("Failed to load complaints"))
      .finally(() => setLoading(false));
  }, [toastT]);

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
      title: prev.title || t("Legal escalation — unresolved complaint"),
      description:
        prev.description ||
        t("I am requesting legal escalation for an unresolved society issue.\n\nExisting complaint ID / date (if any):\n\nIssue summary:\n\nAction requested:"),
    }));
  }, [isAdmin, t]);

  useEffect(() => {
    if (user.name || user.flatNumber) {
      setForm((prev) => ({
        ...prev,
        flatNumber: user.flatNumber || "",
        raisedBy: user.name || "",
      }));
    }
  }, [user.name, user.flatNumber]);

  const selectCategory = (category: ComplaintCategory) => {
    setForm((prev) => ({
      ...prev,
      category,
      priority: isAdmin ? prev.priority : categoryConfig[category].defaultPriority,
    }));
  };

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
        toastT.success("Complaint registered successfully");
        setShowForm(false);
        setForm({
          flatNumber: user?.flatNumber || "",
          raisedBy: user?.name || "",
          title: "",
          description: "",
          category: "general",
          priority: "medium",
        });
        fetchComplaints();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed to submit");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string, res?: string) => {
    try {
      toastT.loading("Updating status...", { id: "stat-upd" });
      const response = await fetch(`/api/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution: res }),
      });
      if (response.ok) {
        toastT.success(status === "resolved" ? "Complaint resolved" : "Complaint updated", { id: "stat-upd" });
        fetchComplaints();
      } else {
        const d = await response.json();
        toastT.error(d.error || "Failed to update", { id: "stat-upd" });
      }
    } catch {
      toastT.error("Failed to update", { id: "stat-upd" });
    }
    setResolveComplaint(null);
    setResolution("");
  };

  const submitRating = async () => {
    if (!rateComplaint || rating < 1) return;
    setRatingSaving(true);
    try {
      const res = await fetch(`/api/complaints/${rateComplaint.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: ratingComment }),
      });
      if (res.ok) {
        toastT.success("Thank you for your feedback");
        setRateComplaint(null);
        setRating(0);
        setRatingComment("");
        fetchComplaints();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed to submit rating");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setRatingSaving(false);
    }
  };

  const openRatingModal = (complaint: Complaint) => {
    setRateComplaint(complaint);
    setRating(0);
    setRatingComment("");
  };

  const canRate = (c: Complaint) =>
    !isAdmin &&
    c.status === "resolved" &&
    !c.satisfactionRating &&
    (user?.flatNumber ? c.flatNumber === user.flatNumber : true);

  const filtered =
    statusFilter === "all" ? complaints : complaints.filter((c) => c.status === statusFilter);

  const complaintGroups =
    statusFilter === "all"
      ? [
          {
            key: "active",
            title: t("Active tickets"),
            description: t("Open and in-progress complaints needing action."),
            items: filtered.filter((c) => !isComplaintHistory(c.status)),
            muted: false,
          },
          {
            key: "history",
            title: t("Resolution history"),
            description: t("Resolved and closed complaints with ratings."),
            items: filtered.filter((c) => isComplaintHistory(c.status)),
            muted: true,
          },
        ].filter((group) => group.items.length > 0)
      : [{ key: "filtered", title: "", description: "", items: filtered, muted: false }];

  const filterLabel = (s: string) => {
    if (s === "all") return t("All");
    return t(statusConfig[s]?.label ?? s);
  };

  const pendingRatings = complaints.filter(canRate);

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={MessageSquare}
        title={t("Help Desk")}
        description={t("Track complaints, ownership, urgency, and resolution progress.")}
        meta={`${stats.total} ${t("tickets")}`}
        tone="amber"
        actions={
          <>
            {isAdmin && societyId && (
              <button
                onClick={() => {
                  const link = `${window.location.origin}/complaint/submit?sId=${societyId}`;
                  navigator.clipboard.writeText(link);
                  toastT.success("Shareable form copied!");
                }}
                className="btn btn-secondary !rounded-xl px-4 sm:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center shrink-0"
              >
                <Share2 className="w-4 h-4 mr-2" /> {t("Share Form")}
              </button>
            )}
            {showRaiseComplaint && (
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.98] shrink-0"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> {t("Raise Complaint")}
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
              <h2 className="font-bold text-red-900 text-sm sm:text-base">{t("Legal escalation workflow")}</h2>
              <p className="text-xs sm:text-sm text-red-800/90 mt-1 leading-relaxed">
                {t("Log or reference your unresolved complaint below. The committee reviews open tickets first; persistent defaulters or rule violations may be referred to the society legal adviser.")}
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
                {t("Call")} {legalAdviserName || t("Legal Adviser")}
              </a>
            ) : (
              <span className="text-xs text-red-700/80 font-medium px-1">
                {t("Legal adviser contact not configured — committee will coordinate escalation.")}
              </span>
            )}
            <Link href="/complaints" className="btn btn-secondary btn-sm flex items-center gap-2">
              {t("Dismiss")}
            </Link>
          </div>
        </div>
      )}

      {!isAdmin && noFlatLinked && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 text-sm">{t("Flat not linked to your account")}</p>
            <p className="text-xs text-amber-800/90 mt-1">
              {t("Contact the committee to link your flat before viewing or raising complaints.")}
            </p>
          </div>
        </div>
      )}

      {!isAdmin && pendingRatings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 flex items-start gap-3">
          <Star className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 text-sm">{t("Rate your resolved complaints")}</p>
            <p className="text-xs text-amber-800/90 mt-1">
              {t("Your feedback helps the committee improve service quality.")}
            </p>
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <ModuleStatCard icon={AlertTriangle} label={t("Open")} value={stats.open} tone="red" />
          <ModuleStatCard icon={Clock} label={t("In Progress")} value={stats.inProgress} tone="amber" />
          <ModuleStatCard icon={CheckCircle2} label={t("Resolved")} value={stats.resolved} tone="emerald" />
          <ModuleStatCard
            icon={Star}
            label={t("Avg Rating")}
            value={stats.avgRating ? `${stats.avgRating}/5` : "—"}
            tone="primary"
          />
          <ModuleStatCard icon={Info} label={t("Total")} value={stats.total} tone="primary" />
        </div>
      ) : (
        <div className="bg-indigo-50/50 p-5 sm:p-6 rounded-2xl border border-indigo-100 flex items-center gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm shrink-0 border border-indigo-50">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-text-primary">{t("Need immediate assistance?")}</p>
            <p className="text-[10px] sm:text-xs text-text-secondary mt-0.5 leading-tight">
              {t("Security Command:")} <strong>{t("Dial 99")}</strong> {t("from your intercom.")}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-bold text-text-primary">
              {isAdmin ? t("Society Queue") : t("My Logged Trackers")}
            </h3>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              {filterStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all shrink-0 ${
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "bg-white border border-border/60 text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  {filterLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="spinner !w-8 !h-8" />
            <p className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">{t("Fetching logs...")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <ModuleEmptyState
            icon={CheckCircle2}
            title={t("Queue is clear")}
            description={t(emptyStateDescriptions[statusFilter] || emptyStateDescriptions.all)}
            tone="emerald"
          />
        ) : (
          <div className="space-y-8">
            {complaintGroups.map((group) => (
              <div key={group.key} className="space-y-4">
                {group.title ? (
                  <ModuleSectionTitle title={group.title} description={group.description} />
                ) : null}
                <div
                  className={`grid grid-cols-1 gap-4 ${group.muted ? "[&>div]:bg-surface/50 [&>div]:opacity-90" : ""}`}
                >
            {group.items.map((c) => {
              const cat = categoryConfig[c.category as ComplaintCategory] ?? categoryConfig.general;
              const CatIcon = cat.icon;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-[1.25rem] border border-border/60 p-5 sm:p-6 transition-all hover:shadow-md hover:border-primary/20 group relative overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="mb-4 px-1">
                        <ComplaintProgress
                          status={c.status}
                          hasRating={Boolean(c.satisfactionRating)}
                        />
                      </div>

                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${statusConfig[c.status]?.color || "bg-gray-100 text-gray-600 border-transparent"}`}
                        >
                          {statusConfig[c.status]?.label ? t(statusConfig[c.status].label) : c.status}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${priorityColors[c.priority] || priorityColors.medium}`}
                        >
                          {t(priorityLabels[c.priority] || c.priority.charAt(0).toUpperCase() + c.priority.slice(1))}
                        </span>
                        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider bg-surface px-2 py-0.5 rounded-full border border-border/30 flex items-center gap-1">
                          <CatIcon className="w-3 h-3" />
                          {t(cat.label)}
                        </span>
                      </div>

                      <h4 className="text-base sm:text-lg font-bold text-text-primary tracking-tight leading-tight mb-2">
                        {c.title}
                      </h4>
                      <p className="text-sm text-text-secondary leading-normal mb-6 font-medium">{c.description}</p>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-5 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-surface border border-border/50 flex items-center justify-center text-primary font-black text-[9px]">
                            {c.flatNumber?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[8px] font-bold text-text-tertiary uppercase leading-none mb-1">
                              {t("Author")}
                            </p>
                            <p className="text-[11px] font-bold text-text-primary leading-none">
                              {c.raisedBy} · {t("Flat")} {c.flatNumber}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-text-tertiary" />
                          <div>
                            <p className="text-[8px] font-bold text-text-tertiary uppercase leading-none mb-1">
                              {t("Recorded")}
                            </p>
                            <p className="text-[11px] font-bold text-text-primary leading-none">
                              {new Date(c.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        {c.resolution && (
                          <div className="flex items-center gap-3 bg-emerald-50/70 py-1.5 px-3 rounded-lg border border-emerald-100/50">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <p className="text-[11px] text-emerald-700 font-semibold tracking-tight">
                              <strong>{t("Resolved:")}</strong> {c.resolution}
                            </p>
                          </div>
                        )}
                        {c.satisfactionRating && (
                          <div className="flex items-center gap-2 bg-amber-50/70 py-1.5 px-3 rounded-lg border border-amber-100/50">
                            <StarRating value={c.satisfactionRating} readonly size="sm" />
                            {c.satisfactionComment && (
                              <p className="text-[11px] text-amber-800 ml-2 italic">&ldquo;{c.satisfactionComment}&rdquo;</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2 shrink-0 md:pl-6 md:border-l border-border/40 sm:pt-4 md:pt-0">
                      {isAdmin && (c.status === "open" || c.status === "in_progress") && (
                        <>
                          {c.status === "open" && (
                            <button
                              onClick={() => updateStatus(c.id, "in_progress")}
                              className="btn btn-secondary !rounded-xl py-2.5 sm:py-3 px-6 text-xs font-bold leading-none hover:bg-amber-50"
                            >
                              {t("Start Working")}
                            </button>
                          )}
                          <button
                            onClick={() => setResolveComplaint(c)}
                            className="btn btn-primary !bg-emerald-600 hover:!bg-emerald-700 !rounded-xl py-2.5 sm:py-3 px-6 text-xs font-bold leading-none shadow-md shadow-emerald-100/50"
                          >
                            {t("Mark Fixed")}
                          </button>
                        </>
                      )}

                      {canRate(c) && (
                        <button
                          onClick={() => openRatingModal(c)}
                          className="btn btn-primary !rounded-xl py-2.5 sm:py-3 px-6 text-xs font-bold leading-none flex items-center gap-2"
                        >
                          <Star className="w-4 h-4" /> {t("Rate Service")}
                        </button>
                      )}

                      {isAdmin && c.status === "resolved" && !c.satisfactionRating && (
                        <span className="text-[10px] text-text-tertiary font-medium text-center px-2">
                          {t("Awaiting resident rating")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div
            className="bg-white w-full max-w-xl sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in slide-in-from-bottom-6 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-primary tracking-tight">{t("Raise Complaint")}</h3>
                  <p className="text-xs font-medium text-text-secondary mt-0.5">
                    {t("Describe the issue — committee will track and resolve it")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6 px-1">
              <ComplaintProgress status="open" compact />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pb-20 sm:pb-0">
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                  {t("What type of issue?")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMPLAINT_CATEGORIES.map((cat) => {
                    const cfg = categoryConfig[cat];
                    const Icon = cfg.icon;
                    const selected = form.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => selectCategory(cat)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border/50 bg-surface hover:border-primary/30"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-bold">{t(cfg.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                    {t("Flat *")}
                  </label>
                  <input
                    className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 disabled:opacity-50"
                    placeholder={t("A-101")}
                    value={form.flatNumber}
                    onChange={(e) => setForm({ ...form, flatNumber: e.target.value })}
                    disabled={!isAdmin && !!user?.flatNumber}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                    {t("Requester *")}
                  </label>
                  <input
                    className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 disabled:opacity-50"
                    placeholder={t("Full Name")}
                    value={form.raisedBy}
                    onChange={(e) => setForm({ ...form, raisedBy: e.target.value })}
                    disabled={!isAdmin && !!user?.name}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                  {t("Issue Title *")}
                </label>
                <input
                  className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5"
                  placeholder={t("Short summary, e.g. Water leakage in bathroom")}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                  {t("Description *")}
                </label>
                <textarea
                  className="input !rounded-2xl !bg-surface !h-auto min-h-[120px] font-medium resize-none text-sm p-4 px-5"
                  placeholder={t("Where is the issue? When did it start? Any other details...")}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                    {t("Urgency")}
                  </label>
                  <select
                    className="select !rounded-xl !bg-surface font-bold py-3.5 px-4"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="low">{t("Standard")}</option>
                    <option value="medium">{t("Medium")}</option>
                    <option value="high">{t("High")}</option>
                    <option value="urgent">{t("Critical")}</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-6 sticky bottom-0 bg-white sm:static">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm"
                >
                  {t("Discard")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20"
                >
                  {saving ? t("Sending...") : t("Submit Complaint")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resolveComplaint && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-md z-[100]" onClick={() => setResolveComplaint(null)}>
          <div
            className="bg-white w-full max-w-lg sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-text-primary tracking-tight">{t("Resolution Report")}</h3>
              <button
                onClick={() => setResolveComplaint(null)}
                className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-surface border border-border/40 text-xs text-text-secondary">
                <strong>{t("Issue:")}</strong> {resolveComplaint.title}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                  {t("What was done to fix this? *")}
                </label>
                <textarea
                  className="input !rounded-2xl !bg-surface !h-auto min-h-[140px] font-medium p-4 text-sm"
                  placeholder={t("Describe the fix so the resident knows what was done...")}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </div>

              <p className="text-xs text-text-tertiary">
                {t("The resident will be notified and asked to rate the service.")}
              </p>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setResolveComplaint(null)}
                  className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={() => updateStatus(resolveComplaint.id, "resolved", resolution)}
                  disabled={!resolution.trim()}
                  className="flex-[2] btn btn-primary !bg-emerald-600 hover:!bg-emerald-700 !rounded-xl py-4 font-bold text-sm shadow-xl shadow-emerald-100/50"
                >
                  {t("Mark Resolved")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rateComplaint && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-md z-[100]" onClick={() => setRateComplaint(null)}>
          <div
            className="bg-white w-full max-w-lg sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-text-primary tracking-tight">{t("Rate Service")}</h3>
                <p className="text-xs text-text-secondary mt-1">{rateComplaint.title}</p>
              </div>
              <button
                onClick={() => setRateComplaint(null)}
                className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {rateComplaint.resolution && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
                  <strong>{t("Resolution:")}</strong> {rateComplaint.resolution}
                </div>
              )}

              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm font-bold text-text-primary">{t("How satisfied are you?")}</p>
                <StarRating value={rating} onChange={setRating} size="lg" />
                <p className="text-[10px] text-text-tertiary">
                  {rating === 0 && t("Tap a star to rate")}
                  {rating === 1 && t("Very dissatisfied")}
                  {rating === 2 && t("Dissatisfied")}
                  {rating === 3 && t("Neutral")}
                  {rating === 4 && t("Satisfied")}
                  {rating === 5 && t("Very satisfied")}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                  {t("Comments (optional)")}
                </label>
                <textarea
                  className="input !rounded-2xl !bg-surface !h-auto min-h-[80px] font-medium p-4 text-sm"
                  placeholder={t("Tell us what went well or what could improve...")}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
              </div>

              {rating > 0 && rating <= 2 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
                  <RotateCcw className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{t("Low ratings are flagged for committee review. You may also raise a follow-up complaint if the issue persists.")}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRateComplaint(null)}
                  className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm"
                >
                  {t("Later")}
                </button>
                <button
                  onClick={submitRating}
                  disabled={rating < 1 || ratingSaving}
                  className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm"
                >
                  {ratingSaving ? t("Submitting...") : t("Submit Rating")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
