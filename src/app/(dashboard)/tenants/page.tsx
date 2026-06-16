"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useEffect, useState, useCallback } from "react";
import { Plus, UserPlus, Search, Phone, Calendar, Home, CheckCircle, Clock, AlertTriangle, X, KeyRound, Copy, Pencil, LogOut } from "lucide-react";
import { useAppDialog } from "@/components/ui/AppDialogProvider";
import { isTenDigitPhone, phoneInputProps, sanitizePhoneInput } from "@/lib/phone-input";

interface TenantEntry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  leaseStart: string;
  leaseEnd: string | null;
  monthlyRent: number | null;
  status: string;
  hasLogin?: boolean;
  billingResponsibility?: string;
  flat: {
    flatNumber: string;
    wing: string | null;
    ownerName: string;
    ownerPhone?: string | null;
    ownerEmail?: string | null;
    ownerLinked?: boolean;
  };
}

interface Flat {
  id: string;
  flatNumber: string;
  wing: string | null;
  ownerName: string;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerLinked?: boolean;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-amber-500/5", text: "text-amber-600", label: "Pending" },
  active: { bg: "bg-emerald-500/5", text: "text-emerald-600", label: "Active" },
  expired: { bg: "bg-red-500/5", text: "text-red-600", label: "Expired" },
  terminated: { bg: "bg-gray-500/5", text: "text-gray-600", label: "Terminated" },
};

const getStatus = (status: string) => status.toLowerCase();

const formatFlatLabel = (flat?: { flatNumber?: string | null; wing?: string | null }) => {
  if (!flat?.flatNumber) return "-";
  const wing = flat.wing?.trim();
  if (!wing) return flat.flatNumber;
  return flat.flatNumber.toUpperCase().startsWith(`${wing.toUpperCase()}-`)
    ? flat.flatNumber
    : `${wing}-${flat.flatNumber}`;
};

export default function TenantsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const { confirm, prompt } = useAppDialog();
  const [tenants, setTenants] = useState<TenantEntry[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingLoginFor, setCreatingLoginFor] = useState<string | null>(null);
  const [updatingPayerFor, setUpdatingPayerFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lastCredentials, setLastCredentials] = useState<{ email: string; password: string; note?: string } | null>(null);

  const [form, setForm] = useState({
    flatId: "", name: "", phone: "", email: "", idProofType: "aadhaar",
    leaseStart: "", leaseEnd: "", monthlyRent: "", password: "", billingResponsibility: "OWNER",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    leaseStart: "",
    leaseEnd: "",
    monthlyRent: "",
    billingResponsibility: "OWNER",
  });

  const fetchTenants = useCallback(() => {
    setLoading(true);
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((d) => setTenants(Array.isArray(d) ? d : []))
      .catch(() => toastT.error("Failed to load tenants"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTenants();
    fetch("/api/members?flatsOnly=true")
      .then((r) => r.json())
      .then((d) => setFlats(Array.isArray(d) ? d : Array.isArray(d.flats) ? d.flats : Array.isArray(d.members) ? d.members : []))
      .catch(() => {});
  }, [fetchTenants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTenDigitPhone(form.phone)) {
      toastT.error("Enter a valid 10-digit tenant phone number");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.loginCredentials) {
          setLastCredentials(data.loginCredentials);
          toastT.success("Tenant registered and login created");
        } else {
          toastT.success("Tenant registered. Add email later to create login.");
        }
        setShowForm(false);
        setForm({ flatId: "", name: "", phone: "", email: "", idProofType: "aadhaar", leaseStart: "", leaseEnd: "", monthlyRent: "", password: "", billingResponsibility: "OWNER" });
        fetchTenants();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed to register tenant");
      }
    } catch { toastT.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const createTenantLogin = async (tenant: TenantEntry) => {
    const email = await prompt({
      title: "Create Tenant Login",
      message: `Create portal access for ${tenant.name}.`,
      label: "Tenant Login Email",
      defaultValue: tenant.email || "",
      placeholder: "tenant@example.com",
      confirmLabel: "Continue",
      required: true,
    });
    if (!email) return;
    const password = await prompt({
      title: "Temporary Password",
      message: "Leave blank to auto-generate a temporary password.",
      label: "Temporary Password",
      placeholder: "Optional",
      confirmLabel: "Create Login",
    });
    setCreatingLoginFor(tenant.id);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to create login");
        return;
      }
      setLastCredentials(data.loginCredentials);
      toastT.success("Tenant login created");
      fetchTenants();
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setCreatingLoginFor(null);
    }
  };

  const copyCredentials = () => {
    if (!lastCredentials) return;
    navigator.clipboard.writeText(`Email: ${lastCredentials.email}\nPassword: ${lastCredentials.password}`);
    toastT.success("Credentials copied");
  };

  const updateMaintenancePayer = async (tenant: TenantEntry, billingResponsibility: string) => {
    setUpdatingPayerFor(tenant.id);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_billing_responsibility",
          tenantId: tenant.id,
          billingResponsibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to update maintenance payer");
        return;
      }
      toastT.success(data.message || "Maintenance payer updated");
      fetchTenants();
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setUpdatingPayerFor(null);
    }
  };

  const openEditTenant = (tenant: TenantEntry) => {
    setEditingTenant(tenant);
    setEditForm({
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email || "",
      leaseStart: new Date(tenant.leaseStart).toISOString().split("T")[0],
      leaseEnd: tenant.leaseEnd ? new Date(tenant.leaseEnd).toISOString().split("T")[0] : "",
      monthlyRent: tenant.monthlyRent?.toString() || "",
      billingResponsibility: tenant.billingResponsibility || "OWNER",
    });
  };

  const saveTenantEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    if (!isTenDigitPhone(editForm.phone)) {
      toastT.error("Enter a valid 10-digit tenant phone number");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_tenant", tenantId: editingTenant.id, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to update tenant");
        return;
      }
      toastT.success("Tenant updated");
      setEditingTenant(null);
      fetchTenants();
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const terminateTenant = async (tenant: TenantEntry) => {
    const ok = await confirm({
      title: "Move Out Tenant",
      message: `Move out ${tenant.name}? This archives the tenant occupancy but keeps history.`,
      confirmLabel: "Move Out",
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate_tenant", tenantId: tenant.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to move out tenant");
        return;
      }
      toastT.success(data.message || "Tenant moved out");
      fetchTenants();
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const filtered = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(search.toLowerCase()) ||
    tenant.phone.includes(search) ||
    (tenant.flat?.flatNumber || "").toLowerCase().includes(search.toLowerCase())
  );

  const active = tenants.filter((tenant) => getStatus(tenant.status) === "active").length;
  const expiringSoon = tenants.filter((tenant) => {
    if (!tenant.leaseEnd || getStatus(tenant.status) !== "active") return false;
    const days = (new Date(tenant.leaseEnd).getTime() - Date.now()) / 86400000;
    return days > 0 && days <= 30;
  }).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-violet-500/5 flex items-center justify-center text-violet-600 shadow-sm border border-violet-500/5">
            <UserPlus className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-none sm:leading-normal">{t("Tenant Management")}</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">{t("Register & manage tenant lifecycle")}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 flex items-center justify-center">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Register Tenant
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: "TOTAL", val: tenants.length, color: "text-primary", bg: "bg-primary/5", icon: UserPlus },
          { label: "ACTIVE", val: active, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
          { label: "EXPIRING SOON", val: expiringSoon, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
          { label: "EXPIRED", val: tenants.filter((tenant) => getStatus(tenant.status) === "expired").length, color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
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

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input className="input !rounded-xl !bg-surface/50 !border-border/60 !pl-11 pr-4 py-2.5 text-xs sm:text-sm font-semibold w-full" placeholder="Search tenant or flat..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card bg-primary/5 border-primary/20">
        <p className="text-sm font-bold text-text-primary">Owner and tenant records are separate</p>
        <p className="text-xs text-text-secondary mt-1">
          Tenant rent is private owner-tenant information. Society maintenance money belongs to the society and is billed either to the owner or directly to the tenant based on the maintenance payer setting.
        </p>
      </div>

      {lastCredentials && (
        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-emerald-800">Tenant login credentials</p>
              <p className="text-xs text-emerald-700 mt-1">Share privately with the tenant. They can login from Sign In.</p>
              <p className="text-xs font-mono font-bold text-text-primary mt-2">{lastCredentials.email} / {lastCredentials.password}</p>
            </div>
            <button onClick={copyCredentials} className="btn btn-secondary btn-sm">
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Tenant List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="spinner !w-8 !h-8" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-24 bg-surface/30 border-dashed border-2">
          <UserPlus className="w-10 h-10 text-text-tertiary mx-auto mb-4 opacity-20" />
          <p className="text-text-primary font-bold">No tenants registered</p>
          <p className="text-xs text-text-secondary mt-1">Register tenants to track lease periods and occupancy</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((tenant) => {
            const normalizedStatus = getStatus(tenant.status);
            const style = statusStyles[normalizedStatus] || statusStyles.pending;
            const daysLeft = tenant.leaseEnd ? Math.ceil((new Date(tenant.leaseEnd).getTime() - Date.now()) / 86400000) : null;
            return (
              <div key={tenant.id} className={`bg-white rounded-[1.25rem] border p-5 sm:p-6 transition-all hover:shadow-md group ${daysLeft !== null && daysLeft <= 30 && daysLeft > 0 ? "border-l-4 border-l-amber-400" : daysLeft !== null && daysLeft <= 0 ? "border-l-4 border-l-red-400" : "border-border/60"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center ${style.text} shrink-0`}>
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-base font-bold text-text-primary">{tenant.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>{t(style.label)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-text-secondary"><Home className="w-3 h-3" /> {formatFlatLabel(tenant.flat)}</span>
                      <span className="flex items-center gap-1 text-xs text-text-secondary"><Phone className="w-3 h-3" /> {tenant.phone}</span>
                      <span className={`flex items-center gap-1 text-xs font-semibold ${tenant.hasLogin ? "text-emerald-600" : "text-amber-600"}`}>
                        <KeyRound className="w-3 h-3" /> {tenant.hasLogin ? t("Login active") : t("No app login")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
                        <Calendar className="w-3 h-3" /> {new Date(tenant.leaseStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {tenant.leaseEnd && ` → ${new Date(tenant.leaseEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                      </span>
                    </div>
                    {tenant.monthlyRent && <p className="text-xs font-bold text-primary mt-1.5">{t("Private rent")}: ₹{tenant.monthlyRent.toLocaleString("en-IN")}/month</p>}
                    {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                      <p className="text-[10px] font-bold text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded-lg inline-block">{t("Lease expires in")} {daysLeft} {t("days")}</p>
                    )}
                    {daysLeft !== null && daysLeft <= 0 && (
                      <p className="text-[10px] font-bold text-red-600 mt-2 bg-red-50 px-2 py-1 rounded-lg inline-block">{t("Lease expired")}</p>
                    )}
                    <div className="mt-3 rounded-xl border border-border bg-white p-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{t("Society maintenance payer")}</label>
                      <select
                        className="select !rounded-lg !py-2 !text-xs mt-2"
                        value={tenant.billingResponsibility || "OWNER"}
                        disabled={updatingPayerFor === tenant.id}
                        onChange={(e) => updateMaintenancePayer(tenant, e.target.value)}
                      >
                        <option value="OWNER">{t("Owner pays society")}</option>
                        <option value="TENANT">{t("Tenant pays society directly")}</option>
                      </select>
                      <p className="text-[10px] text-text-secondary mt-1">
                        {tenant.billingResponsibility === "TENANT"
                          ? t("Invoices for this unit will appear in the tenant's My Bills.")
                          : t("Invoices should go to the owner/co-owner. Link owner first for this to work cleanly.")}
                      </p>
                    </div>
                    <div className={`mt-3 rounded-xl px-3 py-2 ${tenant.flat?.ownerLinked ? "bg-surface/70" : "bg-amber-50"}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${tenant.flat?.ownerLinked ? "text-text-tertiary" : "text-amber-700"}`}>
                        {tenant.flat?.ownerLinked ? t("Linked owner") : t("Owner not linked yet")}
                      </p>
                      <p className="text-xs font-semibold text-text-primary mt-0.5">{tenant.flat?.ownerName || t("Add owner/co-owner occupancy for this unit")}</p>
                      {(tenant.flat?.ownerPhone || tenant.flat?.ownerEmail) && (
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          {[tenant.flat.ownerPhone, tenant.flat.ownerEmail].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {!tenant.hasLogin && (
                      <button
                        onClick={() => createTenantLogin(tenant)}
                        disabled={creatingLoginFor === tenant.id}
                        className="btn btn-secondary btn-sm mt-3 !rounded-xl"
                      >
                        <KeyRound className="w-4 h-4" />
                        {creatingLoginFor === tenant.id ? t("Creating...") : t("Create Tenant Login")}
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => openEditTenant(tenant)} className="btn btn-secondary btn-sm !rounded-xl">
                        <Pencil className="w-4 h-4" />
                        {t("Edit")}
                      </button>
                      {getStatus(tenant.status) === "active" && (
                        <button onClick={() => terminateTenant(tenant)} disabled={saving} className="btn btn-danger btn-sm !rounded-xl">
                          <LogOut className="w-4 h-4" />
                          {t("Move Out")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Tenant Modal */}
      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-xl sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-text-primary">Register Tenant</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-surface text-text-tertiary"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 pb-20 sm:pb-0">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Select Flat *</label>
                <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full" value={form.flatId} onChange={(e) => setForm({ ...form, flatId: e.target.value })} required>
                  <option value="">Choose flat...</option>
                  {flats.map((f) => (
                    <option key={f.id} value={f.id}>{formatFlatLabel(f)} ({f.ownerName || "Owner not linked"})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Tenant Name *</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Phone *</label>
                  <input {...phoneInputProps} className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="10-digit phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhoneInput(e.target.value) })} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Lease Start *</label>
                  <input type="date" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={form.leaseStart} onChange={(e) => setForm({ ...form, leaseStart: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Lease End</label>
                  <input type="date" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={form.leaseEnd} onChange={(e) => setForm({ ...form, leaseEnd: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Private Monthly Rent (₹)</label>
                  <input type="number" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="15000" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} />
                  <p className="text-[10px] text-text-tertiary ml-1">For occupancy records only. This does not affect society finance.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Login Email</label>
                  <input type="email" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="email@..." value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <p className="text-[10px] text-text-tertiary ml-1">Required if tenant should login to the portal.</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Society Maintenance Payer</label>
                <select
                  className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full"
                  value={form.billingResponsibility}
                  onChange={(e) => setForm({ ...form, billingResponsibility: e.target.value })}
                >
                  <option value="OWNER">Owner pays society maintenance</option>
                  <option value="TENANT">Tenant pays society directly</option>
                </select>
                <p className="text-[10px] text-text-tertiary ml-1">
                  Private rent is separate. This setting decides who receives maintenance invoices in Billing & Ledger.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Temporary Password</label>
                <input type="text" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Leave blank to auto-generate" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="text-[10px] text-text-tertiary ml-1">Used only for first login. Share privately and ask the tenant to change it.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">{saving ? "Registering..." : "Register Tenant"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTenant && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setEditingTenant(null)}>
          <div className="bg-white w-full max-w-xl sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-text-primary">Edit Tenant</h3>
                <p className="text-xs text-text-secondary mt-1">{formatFlatLabel(editingTenant.flat)}</p>
              </div>
              <button onClick={() => setEditingTenant(null)} className="p-2 rounded-full hover:bg-surface text-text-tertiary"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={saveTenantEdit} className="space-y-5 pb-20 sm:pb-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Tenant Name *</label>
                  <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Phone *</label>
                  <input {...phoneInputProps} className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: sanitizePhoneInput(e.target.value) })} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Lease Start *</label>
                  <input type="date" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={editForm.leaseStart} onChange={(e) => setEditForm({ ...editForm, leaseStart: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Lease End</label>
                  <input type="date" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={editForm.leaseEnd} onChange={(e) => setEditForm({ ...editForm, leaseEnd: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Private Monthly Rent (₹)</label>
                  <input type="number" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={editForm.monthlyRent} onChange={(e) => setEditForm({ ...editForm, monthlyRent: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Login Email</label>
                  <input type="email" className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Society Maintenance Payer</label>
                <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full" value={editForm.billingResponsibility} onChange={(e) => setEditForm({ ...editForm, billingResponsibility: e.target.value })}>
                  <option value="OWNER">Owner pays society maintenance</option>
                  <option value="TENANT">Tenant pays society directly</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingTenant(null)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">{saving ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
