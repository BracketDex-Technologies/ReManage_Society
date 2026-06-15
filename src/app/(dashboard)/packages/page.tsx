"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Plus, Package as PackageIcon, Search, CheckCircle, Clock, AlertTriangle, Truck } from "lucide-react";

interface PackageEntry {
  id: string;
  courierName: string | null;
  description: string | null;
  status: string;
  receivedAt: string;
  collectedAt: string | null;
  collectedBy: string | null;
  pickupOtp: string | null;
  flat: { flatNumber: string; wing: string | null; ownerName: string; contact: string };
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  received: { bg: "bg-amber-500/5", text: "text-amber-600", label: "At Gate" },
  notified: { bg: "bg-blue-500/5", text: "text-blue-600", label: "Notified" },
  collected: { bg: "bg-emerald-500/5", text: "text-emerald-600", label: "Collected" },
  returned: { bg: "bg-red-500/5", text: "text-red-600", label: "Returned" },
  lost: { bg: "bg-gray-500/5", text: "text-gray-600", label: "Lost" },
};

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [form, setForm] = useState({ flatNumber: "", courierName: "", description: "" });

  const fetchPackages = useCallback(() => {
    setLoading(true);
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => setPackages(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Failed to load packages"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Package logged successfully");
        setShowForm(false);
        setForm({ flatNumber: "", courierName: "", description: "" });
        fetchPackages();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to log package");
      }
    } catch { toast.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const markCollected = async (packageId: string) => {
    try {
      const res = await fetch("/api/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, action: "collected" }),
      });
      if (res.ok) {
        toast.success("Package marked as collected ✅");
        fetchPackages();
      }
    } catch { toast.error("Failed to update"); }
  };

  const filtered = packages.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search && !p.flat.flatNumber.toLowerCase().includes(search.toLowerCase()) &&
        !(p.courierName || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pending = packages.filter((p) => p.status === "received" || p.status === "notified").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/5 flex items-center justify-center text-amber-600 shadow-sm border border-amber-500/5">
            <PackageIcon className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-none sm:leading-normal">Parcel Desk</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">Track deliveries & courier packages</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 flex items-center justify-center">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Log Package
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: "TOTAL TODAY", val: packages.length, color: "text-primary", bg: "bg-primary/5", icon: PackageIcon },
          { label: "PENDING PICKUP", val: pending, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
          { label: "COLLECTED", val: packages.filter((p) => p.status === "collected").length, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
          { label: "OVERDUE", val: packages.filter((p) => { if (p.status !== "received") return false; const hrs = (Date.now() - new Date(p.receivedAt).getTime()) / 3600000; return hrs > 24; }).length, color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 sm:p-6 rounded-2xl border border-border/50 group transition-all hover:border-primary/20 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-text-tertiary mt-4 tracking-[0.1em] uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "received", "collected", "returned"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${filter === f ? "bg-primary text-white shadow-sm" : "bg-surface text-text-secondary hover:bg-primary/5"}`}>
              {f === "all" ? "All" : (statusStyles[f]?.label || f)}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input className="input !rounded-xl !bg-surface/50 !border-border/60 !pl-11 pr-4 py-2.5 text-xs sm:text-sm font-semibold w-full" placeholder="Search flat or courier..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Package List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="spinner !w-8 !h-8" />
          <p className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">Loading packages...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-24 bg-surface/30 border-dashed border-2">
          <PackageIcon className="w-10 h-10 text-text-tertiary mx-auto mb-4 opacity-20" />
          <p className="text-text-primary font-bold">No packages found</p>
          <p className="text-xs text-text-secondary mt-1">Log incoming deliveries at the gate</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const style = statusStyles[p.status] || statusStyles.received;
            const hoursAgo = Math.round((Date.now() - new Date(p.receivedAt).getTime()) / 3600000);
            return (
              <div key={p.id} className={`bg-white rounded-[1.25rem] border p-5 sm:p-6 transition-all hover:shadow-md group ${p.status === "received" && hoursAgo > 24 ? "border-l-4 border-l-red-400" : "border-border/60"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center ${style.text} shrink-0`}>
                    <Truck className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-base font-bold text-text-primary">{p.courierName || "Package"}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>{style.label}</span>
                    </div>
                    <p className="text-xs text-text-secondary">Flat {p.flat.wing ? `${p.flat.wing}-` : ""}{p.flat.flatNumber} · {p.flat.ownerName}</p>
                    {p.description && <p className="text-[11px] text-text-tertiary mt-1">{p.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-text-tertiary">{new Date(p.receivedAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
                      {hoursAgo > 0 && p.status === "received" && <span className={`text-[10px] font-bold ${hoursAgo > 24 ? "text-red-500" : "text-amber-500"}`}>{hoursAgo}h ago</span>}
                    </div>
                  </div>
                </div>
                {p.status === "received" && (
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <button onClick={() => markCollected(p.id)} className="w-full btn btn-primary !rounded-xl !py-2.5 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Collected
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Log Package Modal */}
      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-md sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-text-primary mb-6">Log New Package</h3>
            <form onSubmit={handleSubmit} className="space-y-5 pb-20 sm:pb-0">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Flat Number *</label>
                <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="e.g. A-101" value={form.flatNumber} onChange={(e) => setForm({ ...form, flatNumber: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Courier Name</label>
                <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Amazon, Flipkart, Swiggy..." value={form.courierName} onChange={(e) => setForm({ ...form, courierName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Description</label>
                <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Large box, envelope..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">{saving ? "Logging..." : "Log Package"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
