"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Plus, Users, Clock, Phone, Search, X, CheckCircle, LogOut as LogOutIcon, Briefcase } from "lucide-react";

import { formatCurrency } from "@/lib/utils";
import { useUser } from "@/lib/user-context";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  category: string;
  entryCode: string | null;
  isActive: boolean;
  flatLinks: { agreedMonthlyPay: number | null; flat: { flatNumber: string; wing: string | null } }[];
}

interface Flat {
  id: string;
  flatNumber: string;
  wing: string | null;
}

const categoryStyles: Record<string, { bg: string; text: string; label: string }> = {
  maid: { bg: "bg-pink-500/5", text: "text-pink-600", label: "Maid" },
  cook: { bg: "bg-orange-500/5", text: "text-orange-600", label: "Cook" },
  driver: { bg: "bg-blue-500/5", text: "text-blue-600", label: "Driver" },
  nanny: { bg: "bg-purple-500/5", text: "text-purple-600", label: "Nanny" },
  gardener: { bg: "bg-emerald-500/5", text: "text-emerald-600", label: "Gardener" },
  watchman: { bg: "bg-amber-500/5", text: "text-amber-600", label: "Watchman" },
  other: { bg: "bg-gray-500/5", text: "text-gray-600", label: "Other" },
};

export default function StaffPage() {
  const { user, loaded } = useUser();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [marking, setMarking] = useState<string | null>(null);
  const [noFlatLinked, setNoFlatLinked] = useState(false);

  const isResident = user.role === "member" || user.role === "tenant";
  const canManageAllFlats = ["chairman", "secretary", "treasurer", "facility_manager"].includes(user.role);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    category: "maid",
    flatIds: [] as string[],
    agreedMonthlyPay: "",
  });

  const fetchStaff = useCallback(() => {
    setLoading(true);
    fetch("/api/staff", { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load staff (${r.status})`);
        }
        return r.json();
      })
      .then((d) => setStaff(Array.isArray(d) ? d : []))
      .catch((err: Error) => toast.error(err.message || "Failed to load staff"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loaded) return;

    fetchStaff();

    if (canManageAllFlats) {
      fetch("/api/members?flatsOnly=true", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { flats: [] }))
        .then((d) => setFlats(d.flats || d || []))
        .catch(() => {});
      return;
    }

    if (isResident && !user.flatNumber) {
      setNoFlatLinked(true);
      return;
    }

    setNoFlatLinked(false);
  }, [loaded, fetchStaff, canManageAllFlats, isResident, user.flatNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Staff member registered");
        setShowForm(false);
        setForm({ name: "", phone: "", category: "maid", flatIds: [], agreedMonthlyPay: "" });
        fetchStaff();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to register staff");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const markAttendance = async (staffId: string) => {
    setMarking(staffId);
    try {
      const res = await fetch("/api/staff/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          data.action === "checkin"
            ? `${data.staff.name} checked IN ✅`
            : `${data.staff.name} checked OUT 👋`
        );
      }
    } catch {
      toast.error("Failed to record attendance");
    } finally {
      setMarking(null);
    }
  };

  const toggleFlatSelection = (flatId: string) => {
    setForm((prev) => ({
      ...prev,
      flatIds: prev.flatIds.includes(flatId)
        ? prev.flatIds.filter((id) => id !== flatId)
        : [...prev.flatIds, flatId],
    }));
  };

  const filtered = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = staff.filter((s) => s.isActive).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-pink-500/5 flex items-center justify-center text-pink-600 shadow-sm border border-pink-500/5">
            <Briefcase className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-none sm:leading-normal">
              Staff & Daily Help
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">
              Register & track domestic staff attendance
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={noFlatLinked && isResident}
          className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center disabled:opacity-50"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Register Staff
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {[
          { label: "REGISTERED", val: staff.length, color: "text-primary", bg: "bg-primary/5", icon: Users },
          { label: "ACTIVE", val: activeCount, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
          { label: "CATEGORIES", val: new Set(staff.map((s) => s.category)).size, color: "text-purple-600", bg: "bg-purple-50", icon: Briefcase },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 sm:p-6 rounded-2xl border border-border/50 group transition-all hover:border-primary/20 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color} transition-transform group-hover:scale-110`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-text-tertiary mt-4 tracking-[0.1em] uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <h3 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <Clock className="w-5 h-5 text-text-tertiary" /> Staff Directory
        </h3>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            className="input !rounded-xl !bg-surface/50 !border-border/60 !pl-11 pr-4 py-2.5 text-xs sm:text-sm font-semibold w-full"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Staff List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="spinner !w-8 !h-8" />
          <p className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">Loading staff...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-24 bg-surface/30 border-dashed border-2">
          <Briefcase className="w-10 h-10 text-text-tertiary mx-auto mb-4 opacity-20" />
          <p className="text-text-primary font-bold">
            {noFlatLinked ? "No flat linked to your account" : "No staff registered yet"}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {noFlatLinked
              ? "Ask your society admin to link your flat, then register maids, cooks, or drivers here."
              : "Register maids, cooks, drivers to start tracking attendance"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((s) => {
            const style = categoryStyles[s.category] || categoryStyles.other;
            return (
              <div key={s.id} className="bg-white rounded-[1.25rem] border border-border/60 p-5 sm:p-6 transition-all hover:shadow-md hover:border-primary/20 group">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center ${style.text} shrink-0`}>
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-base font-bold text-text-primary tracking-tight">{s.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-text-secondary">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </span>
                    </div>
                    {s.flatLinks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.flatLinks.map((fl, i) => (
                          <span key={i} className="text-[10px] font-bold bg-surface px-2 py-0.5 rounded-full text-text-secondary">
                            {fl.flat.wing ? `${fl.flat.wing}-` : ""}{fl.flat.flatNumber}
                            {fl.agreedMonthlyPay ? ` · ${formatCurrency(fl.agreedMonthlyPay)}/mo` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.entryCode && (
                      <p className="text-[10px] font-mono font-bold text-primary mt-2 bg-primary/5 px-2 py-1 rounded-lg inline-block">
                        Gate Code: {s.entryCode}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border/40 flex gap-2">
                  <button
                    onClick={() => markAttendance(s.id)}
                    disabled={marking === s.id}
                    className="flex-1 btn btn-primary !rounded-xl !py-2.5 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {marking === s.id ? (
                      "Recording..."
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" /> Check In / Out
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Staff Modal */}
      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-xl sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-primary tracking-tight">Register Staff</h3>
                  <p className="text-xs font-medium text-text-secondary mt-0.5">Add domestic help or society staff</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-surface text-text-tertiary"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pb-20 sm:pb-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Name *</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Staff name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Phone *</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="+91 00000 00000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Category *</label>
                <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="maid">Maid</option>
                  <option value="cook">Cook</option>
                  <option value="driver">Driver</option>
                  <option value="nanny">Nanny</option>
                  <option value="gardener">Gardener</option>
                  <option value="watchman">Watchman</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Pre-agreed Monthly Amount</label>
                <input
                  type="number"
                  min="0"
                  className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5"
                  placeholder="e.g. 2500"
                  value={form.agreedMonthlyPay}
                  onChange={(e) => setForm({ ...form, agreedMonthlyPay: e.target.value })}
                />
                <p className="text-[10px] text-text-secondary ml-1">Used to prefill private staff payments in My Bills. This is not society payroll.</p>
              </div>

              {flats.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Linked Flats</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-surface/50 rounded-xl border border-border/40">
                    {flats.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFlatSelection(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          form.flatIds.includes(f.id)
                            ? "bg-primary text-white shadow-sm"
                            : "bg-white text-text-secondary border border-border/60 hover:border-primary/40"
                        }`}
                      >
                        {f.wing ? `${f.wing}-` : ""}{f.flatNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-6 sticky bottom-0 bg-white sm:static">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">
                  {saving ? "Registering..." : "Register Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
