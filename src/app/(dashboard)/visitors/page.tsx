"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useUser } from "@/lib/user-context";
import PageState from "@/components/ux/PageState";
import { useSearchParams } from "next/navigation";
import { LIVE_FAST_INTERVAL_MS } from "@/lib/live-refresh";
import { isOptionalTenDigitPhone, phoneInputProps, sanitizePhoneInput } from "@/lib/phone-input";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import {
  Plus, UserCheck, LogOut as LogOutIcon, Clock, Users, ShieldCheck,
  Phone, Car, Search, X, KeyRound, CheckCircle2, XCircle, Bell, Copy,
} from "lucide-react";

interface Visitor {
  id: string;
  flatNumber: string;
  visitorName: string;
  phone: string | null;
  purpose: string;
  vehicleNo: string | null;
  entryTime: string;
  exitTime: string | null;
  approvedBy: string | null;
  status: string;
  notes: string | null;
  isPreApproved: boolean;
  passcode: string | null;
  residentResponse: string | null;
  respondedAt: string | null;
  expectedAt: string | null;
  flat?: { flatNumber: string; wing: string | null; ownerName: string } | null;
}

const purposeStyles: Record<string, { bg: string; text: string; label: string }> = {
  delivery: { bg: "bg-orange-500/5", text: "text-orange-600", label: "Delivery" },
  guest: { bg: "bg-blue-500/5", text: "text-blue-600", label: "Guest" },
  service: { bg: "bg-purple-500/5", text: "text-purple-600", label: "Service" },
  cab: { bg: "bg-emerald-500/5", text: "text-emerald-600", label: "Cab" },
  other: { bg: "bg-gray-500/5", text: "text-gray-600", label: "Other" },
};

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  in: { bg: "bg-green-500/10", text: "text-green-700", label: "Inside" },
  out: { bg: "bg-gray-500/10", text: "text-gray-600", label: "Left" },
  expected: { bg: "bg-amber-500/10", text: "text-amber-700", label: "Expected" },
  rejected: { bg: "bg-red-500/10", text: "text-red-700", label: "Rejected" },
};

function VisitorsContent() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const searchParams = useSearchParams();
  const approveId = searchParams.get("approve");

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState({ totalToday: 0, pending: 0, inside: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "inside" | "expected">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    flatNumber: "",
    visitorName: "",
    phone: "",
    purpose: "guest",
    vehicleNo: "",
    expectedAt: "",
  });

  const fetchVisitors = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    fetch("/api/visitors/preapprove")
      .then((r) => r.json())
      .then((d) => {
        setVisitors(d.visitors || []);
        setStats(d.stats || { totalToday: 0, pending: 0, inside: 0 });
      })
      .catch(() => {
        if (!isBackground) toastT.error("Failed to load visitor records");
      })
      .finally(() => {
        if (!isBackground) setLoading(false);
      });
  }, [toastT]);

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
    if (user.flatNumber) setForm((prev) => ({ ...prev, flatNumber: user.flatNumber! }));
  }, [user.flatNumber]);

  useEffect(() => {
    if (approveId && visitors.length > 0) {
      const v = visitors.find((vis) => vis.id === approveId);
      if (v && !v.residentResponse) {
        setActiveTab("pending");
      }
    }
  }, [approveId, visitors]);

  const handlePreApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.visitorName || !form.flatNumber) {
      toastT.error("Visitor name and flat number are required");
      return;
    }
    if (!isOptionalTenDigitPhone(form.phone)) {
      toastT.error("Enter a valid 10-digit visitor phone number");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/visitors/preapprove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(`${t("Pre-approved! Passcode:")} ${data.passcode}`, { duration: 8000 });
        setShowForm(false);
        setForm({ flatNumber: user?.flatNumber || "", visitorName: "", phone: "", purpose: "guest", vehicleNo: "", expectedAt: "" });
        fetchVisitors();
      } else {
        toastT.error(data.error || "Failed");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (visitorId: string, action: "approved" | "rejected") => {
    setActionLoading(visitorId);
    try {
      const res = await fetch("/api/visitors/preapprove", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, action }),
      });
      if (res.ok) {
        toastT.success(action === "approved" ? "Visitor approved! Guard notified." : "Visitor rejected.");
        fetchVisitors();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed");
      }
    } catch {
      toastT.error("Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const markExit = async (id: string) => {
    const loadId = toastT.loading("Recording exit...");
    try {
      const res = await fetch(`/api/visitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "out" }),
      });
      if (res.ok) {
        toastT.success("Exit recorded", { id: loadId });
        fetchVisitors();
      } else {
        toastT.error("Failed", { id: loadId });
      }
    } catch {
      toastT.error("Failed", { id: loadId });
    }
  };

  const copyPasscode = (code: string) => {
    navigator.clipboard.writeText(code);
    toastT.success("Passcode copied!", { duration: 1500 });
  };

  const filtered = visitors.filter((v) => {
    const matchSearch =
      v.visitorName.toLowerCase().includes(search.toLowerCase()) ||
      v.flatNumber.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "pending") return matchSearch && v.status === "expected" && !v.residentResponse;
    if (activeTab === "inside") return matchSearch && v.status === "in";
    if (activeTab === "expected") return matchSearch && v.status === "expected" && v.isPreApproved;
    return matchSearch;
  });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}${t("m ago")}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t("h ago")}`;
    return `${Math.floor(hrs / 24)}${t("d ago")}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <Users className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">{t("Visitor Management")}</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5 font-medium">{t("Pre-approve & track visitors")}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary !rounded-xl px-5 py-2.5 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-primary/10">
          <Plus className="w-4 h-4" />
          {t("Pre-Approve Visitor")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        {[
          { label: "TODAY", val: stats.totalToday, icon: Users, color: "text-primary", bg: "bg-primary/5" },
          { label: "PENDING APPROVAL", val: stats.pending, icon: Bell, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "CURRENTLY INSIDE", val: stats.inside, icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 sm:p-6 rounded-2xl border border-border/50 transition-all hover:border-primary/20 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
            <p className="text-[8px] sm:text-[10px] font-bold text-text-tertiary mt-3 tracking-[0.1em] uppercase">{t(s.label)}</p>
          </div>
        ))}
      </div>

      {/* Pending Approvals Banner */}
      {stats.pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-center gap-4 animate-pulse-subtle">
          <Bell className="w-8 h-8 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">{stats.pending} {t("visitor(s) waiting for your approval")}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t('Tap "Pending" tab to approve or reject')}</p>
          </div>
          <button onClick={() => setActiveTab("pending")} className="btn btn-primary !rounded-xl !py-2 !px-4 text-xs font-bold">
            {t("Review")}
          </button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "pending", "inside", "expected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeTab === tab ? "bg-primary text-white shadow-sm" : "bg-surface text-text-secondary hover:bg-primary/5"}`}
            >
              {tab === "all" ? t("All Visitors") : tab === "pending" ? `${t("Pending")} (${stats.pending})` : tab === "inside" ? t("Inside") : t("Pre-Approved")}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input className="input !rounded-xl !bg-surface/50 !pl-11 pr-4 py-2.5 text-xs font-semibold w-full" placeholder={t("Search...")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Pre-Approve Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{t("Pre-Approve Visitor")}</h2>
                  <p className="text-xs text-text-secondary">{t("Generate a passcode for your visitor")}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-surface"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handlePreApprove} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Visitor Name *")}</label>
                  <input className="input !rounded-xl text-sm font-semibold" required value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} placeholder={t("John Doe")} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Flat Number *")}</label>
                  <input className="input !rounded-xl text-sm font-semibold" required value={form.flatNumber} onChange={(e) => setForm({ ...form, flatNumber: e.target.value })} placeholder={t("A-101")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Phone")}</label>
                  <input {...phoneInputProps} className="input !rounded-xl text-sm font-semibold" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhoneInput(e.target.value) })} placeholder={t("10-digit phone")} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Purpose")}</label>
                  <select className="input !rounded-xl text-sm font-semibold" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                    <option value="guest">{t("Guest")}</option>
                    <option value="delivery">{t("Delivery")}</option>
                    <option value="service">{t("Service")}</option>
                    <option value="cab">{t("Cab")}</option>
                    <option value="other">{t("Other")}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Vehicle No.")}</label>
                  <input className="input !rounded-xl text-sm font-semibold" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} placeholder={t("MH-01-AB-1234")} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Expected Arrival")}</label>
                  <input type="datetime-local" className="input !rounded-xl text-sm font-semibold" value={form.expectedAt} onChange={(e) => setForm({ ...form, expectedAt: e.target.value })} />
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 font-medium">
                {t("💡 A 6-digit passcode will be generated. Share it with your visitor — the guard will verify it at the gate.")}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary !rounded-xl !py-2.5 !px-6 text-xs font-bold">{t("Cancel")}</button>
                <button type="submit" disabled={saving} className="btn btn-primary !rounded-xl !py-2.5 !px-6 text-xs font-bold flex items-center gap-2">
                  {saving ? <div className="spinner !w-4 !h-4" /> : <KeyRound className="w-4 h-4" />}
                  {saving ? t("Generating...") : t("Generate Passcode")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visitor List */}
      {loading ? (
        <PageState variant="loading" title={t("Loading gate activity")} description={t("Fetching visitor entries and expected arrivals.")} />
      ) : filtered.length === 0 ? (
        <PageState
          variant="empty"
          title={t("No visitors found")}
          description={t("Pre-approve a visitor to get started.")}
          actionLabel={t("Open gate console")}
          actionHref="/visitors"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const pStyle = purposeStyles[v.purpose] || purposeStyles.other;
            const sStyle = statusStyles[v.status] || statusStyles.out;
            const isPending = v.status === "expected" && !v.residentResponse && !v.isPreApproved;

            return (
              <div key={v.id} className={`bg-white rounded-2xl border transition-all hover:shadow-sm p-4 sm:p-5 ${isPending ? "border-amber-300 shadow-amber-100 shadow-sm" : "border-border/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${pStyle.bg} flex items-center justify-center ${pStyle.text} shrink-0 text-lg font-bold`}>
                      {v.visitorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-text-primary truncate">{v.visitorName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${sStyle.bg} ${sStyle.text}`}>
                          {t(sStyle.label)}
                        </span>
                        {v.isPreApproved && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-500/10 text-green-700">
                            {t("Pre-Approved")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-text-tertiary flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> {t("Flat")} {v.flatNumber}
                        </span>
                        <span className={`text-[10px] font-bold ${pStyle.text} flex items-center gap-1`}>
                          {t(pStyle.label)}
                        </span>
                        {v.phone && (
                          <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {v.phone}
                          </span>
                        )}
                        {v.vehicleNo && (
                          <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                            <Car className="w-3 h-3" /> {v.vehicleNo}
                          </span>
                        )}
                        <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeAgo(v.entryTime)}
                        </span>
                      </div>
                      {v.isPreApproved && v.passcode && v.status === "expected" && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="bg-primary/5 text-primary font-mono text-sm font-bold px-3 py-1 rounded-lg tracking-[0.3em]">
                            {v.passcode}
                          </span>
                          <button onClick={() => copyPasscode(v.passcode!)} className="p-1.5 rounded-lg hover:bg-surface text-text-tertiary">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] text-text-tertiary">{t("Share this passcode with visitor")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleApproval(v.id, "approved")}
                          disabled={actionLoading === v.id}
                          className="btn !rounded-xl !py-2 !px-3 text-xs font-bold bg-green-500 text-white hover:bg-green-600 flex items-center gap-1.5 shadow-sm"
                        >
                          {actionLoading === v.id ? <div className="spinner !w-3.5 !h-3.5 !border-white" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {t("Approve")}
                        </button>
                        <button
                          onClick={() => handleApproval(v.id, "rejected")}
                          disabled={actionLoading === v.id}
                          className="btn !rounded-xl !py-2 !px-3 text-xs font-bold bg-red-500 text-white hover:bg-red-600 flex items-center gap-1.5 shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {t("Reject")}
                        </button>
                      </>
                    )}
                    {v.status === "in" && (
                      <button onClick={() => markExit(v.id)} className="btn btn-secondary !rounded-xl !py-2 !px-3 text-xs font-bold flex items-center gap-1.5">
                        <LogOutIcon className="w-3.5 h-3.5" /> {t("Exit")}
                      </button>
                    )}
                    {v.residentResponse === "approved" && v.status !== "in" && (
                      <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> {t("Approved by")} {v.approvedBy}
                      </span>
                    )}
                    {v.residentResponse === "rejected" && (
                      <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> {t("Rejected")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VisitorsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="spinner !w-8 !h-8" /></div>}>
      <VisitorsContent />
    </Suspense>
  );
}
