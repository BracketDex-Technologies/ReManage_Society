"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useEffect, useState, useCallback } from "react";
import { Key, Users, Shield, UserPlus, Download, RefreshCw, Copy, Eye, EyeOff, Search, ChevronDown, ChevronUp } from "lucide-react";
import { isOptionalTenDigitPhone, phoneInputProps, sanitizePhoneInput } from "@/lib/phone-input";
import Pagination from "@/components/ui/Pagination";

interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  flat: { flatNumber: string; wing: string | null } | null;
  createdAt: string;
}

interface GeneratedAccount {
  flatNumber: string;
  wing: string | null;
  ownerName: string;
  email: string;
  password: string;
  role: string;
}

interface CredentialsSummary {
  total: number;
  admins: number;
  members: number;
  tenants: number;
  guards: number;
}

type RoleTab = "all" | "members" | "guards" | "admins" | "tenants";

const roleStyles: Record<string, { bg: string; text: string; label: string }> = {
  chairman: { bg: "bg-amber-500/5", text: "text-amber-700", label: "Chairman" },
  secretary: { bg: "bg-blue-500/5", text: "text-blue-700", label: "Secretary" },
  treasurer: { bg: "bg-emerald-500/5", text: "text-emerald-700", label: "Treasurer" },
  member: { bg: "bg-primary/5", text: "text-primary", label: "Resident" },
  tenant: { bg: "bg-violet-500/5", text: "text-violet-700", label: "Tenant" },
  guard: { bg: "bg-orange-500/5", text: "text-orange-700", label: "Guard" },
};

const tabLabels: Record<RoleTab, string> = {
  all: "All Users",
  members: "Residents",
  admins: "Committee",
  tenants: "Tenants",
  guards: "Guards",
};

export default function CredentialsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [summary, setSummary] = useState<CredentialsSummary>({ total: 0, admins: 0, members: 0, tenants: 0, guards: 0 });
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedAccounts, setGeneratedAccounts] = useState<GeneratedAccount[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<RoleTab>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCommitteeForm, setShowCommitteeForm] = useState(false);
  const [committeeSaving, setCommitteeSaving] = useState(false);
  const [committeeForm, setCommitteeForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "secretary",
  });

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (activeTab !== "all") params.set("role", activeTab);
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());

    fetch(`/api/credentials?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setTotal(d.total || 0);
        setTotalPages(d.pages || 1);
        setJoinCode(d.joinCode || null);
        if (d.summary) setSummary(d.summary);
      })
      .catch(() => toastT.error("Failed to load accounts"))
      .finally(() => setLoading(false));
  }, [search, activeTab, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const generateCredentials = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedAccounts(data.accounts || []);
        toastT.success(`${data.created} accounts created`);
        fetchUsers();
      } else {
        toastT.error(data.error || "Failed to generate");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const createCommitteeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOptionalTenDigitPhone(committeeForm.phone)) {
      toastT.error("Enter a valid 10-digit phone number");
      return;
    }
    setCommitteeSaving(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_committee", ...committeeForm }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(`${committeeForm.role} account created`);
        setCommitteeForm({ name: "", email: "", phone: "", password: "", role: "secretary" });
        setActiveTab("admins");
        setPage(1);
        fetchUsers();
      } else {
        toastT.error(data.error || "Failed to create account");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setCommitteeSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toastT.success("Copied!", { duration: 1500 });
  };

  const exportCSV = () => {
    if (!generatedAccounts.length) return;
    const header = "Flat,Wing,Owner,Email,Password,Role\n";
    const rows = generatedAccounts
      .map((a) => `${a.flatNumber},${a.wing || ""},${a.ownerName},${a.email},${a.password},${a.role}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resident_credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
    toastT.success("CSV downloaded");
  };

  const tabCount = (tab: RoleTab) => {
    if (tab === "all") return summary.total;
    if (tab === "admins") return summary.admins;
    if (tab === "members") return summary.members;
    if (tab === "tenants") return summary.tenants;
    return summary.guards;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <Key className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">{t("Access Control")}</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">
              {summary.total} login accounts · manage credentials and committee access
            </p>
          </div>
        </div>
        <button
          onClick={generateCredentials}
          disabled={generating}
          className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 flex items-center justify-center gap-2"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {generating ? "Generating..." : "Auto-Generate Resident Logins"}
        </button>
      </div>

      {joinCode && (
        <div className="bg-white rounded-2xl border border-border/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-text-tertiary tracking-[0.15em] uppercase">Society Join Code</p>
            <p className="text-sm text-text-secondary mt-1">
              Residents can also self-register at /join using this code instead of auto-generated logins.
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(joinCode)}
            className="btn btn-secondary !rounded-xl !py-3 !px-5 font-mono text-lg font-bold tracking-widest"
          >
            {joinCode}
            <Copy className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "Total", val: summary.total, color: "text-primary", bg: "bg-primary/5", icon: Users },
          { label: "Residents", val: summary.members, color: "text-blue-600", bg: "bg-blue-50", icon: Users },
          { label: "Tenants", val: summary.tenants, color: "text-violet-600", bg: "bg-violet-50", icon: Users },
          { label: "Guards", val: summary.guards, color: "text-orange-600", bg: "bg-orange-50", icon: Shield },
          { label: "Committee", val: summary.admins, color: "text-amber-600", bg: "bg-amber-50", icon: Key },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 rounded-2xl border border-border/50 transition-all hover:border-primary/20">
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            </div>
            <p className="text-[10px] font-bold text-text-tertiary mt-3 tracking-wider uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCommitteeForm((open) => !open)}
          className="w-full flex items-center justify-between gap-4 p-5 text-left"
        >
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Committee Logins
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Create secretary or treasurer accounts for this society.
            </p>
          </div>
          {showCommitteeForm ? <ChevronUp className="w-5 h-5 text-text-secondary" /> : <ChevronDown className="w-5 h-5 text-text-secondary" />}
        </button>

        {showCommitteeForm && (
          <form onSubmit={createCommitteeAccount} className="px-5 pb-5 pt-0 border-t border-border/40 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 md:col-start-1 md:row-start-1">
              <label className="label">Name *</label>
              <input className="input" value={committeeForm.name} onChange={(e) => setCommitteeForm({ ...committeeForm, name: e.target.value })} required />
            </div>
            <div className="md:col-span-1 md:col-start-3 md:row-start-1">
              <label className="label">Role *</label>
              <select className="select" value={committeeForm.role} onChange={(e) => setCommitteeForm({ ...committeeForm, role: e.target.value })}>
                <option value="secretary">Secretary</option>
                <option value="treasurer">Treasurer</option>
                <option value="guard">Guard</option>
              </select>
            </div>
            <div className="md:col-span-2 md:col-start-4 md:row-start-1">
              <label className="label">Email *</label>
              <input type="email" className="input" value={committeeForm.email} onChange={(e) => setCommitteeForm({ ...committeeForm, email: e.target.value })} required />
            </div>
            <div className="md:col-span-1 md:col-start-1 md:row-start-2">
              <label className="label">Phone</label>
              <input {...phoneInputProps} className="input" value={committeeForm.phone} onChange={(e) => setCommitteeForm({ ...committeeForm, phone: sanitizePhoneInput(e.target.value) })} />
            </div>
            <div className="md:col-span-2 md:col-start-2 md:row-start-2">
              <label className="label">Temporary Password *</label>
              <input type="password" className="input" minLength={6} value={committeeForm.password} onChange={(e) => setCommitteeForm({ ...committeeForm, password: e.target.value })} required />
            </div>
            <div className="md:col-span-3 md:col-start-4 md:row-start-2 flex items-end">
              <button type="submit" disabled={committeeSaving} className="btn btn-primary w-full md:w-auto">
                {committeeSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Create Committee Login
              </button>
            </div>
          </form>
        )}
      </div>

      {generatedAccounts.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-emerald-800">{generatedAccounts.length} New Accounts Created</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowPasswords(!showPasswords)} className="btn btn-secondary !rounded-xl !py-2 !px-4 text-xs font-bold flex items-center gap-1.5">
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPasswords ? "Hide" : "Show"} Passwords
              </button>
              <button onClick={exportCSV} className="btn btn-primary !rounded-xl !py-2 !px-4 text-xs font-bold flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {generatedAccounts.map((a, i) => (
              <div key={i} className="bg-white rounded-xl p-3 flex items-center justify-between gap-4 border border-emerald-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                    {a.wing ? `${a.wing}-` : ""}
                    {a.flatNumber}
                  </span>
                  <span className="text-sm font-semibold text-text-primary truncate">{a.ownerName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] text-text-tertiary font-mono">{a.email}</p>
                    <p className="text-xs font-mono font-bold text-primary">{showPasswords ? a.password : "••••••••"}</p>
                  </div>
                  <button onClick={() => copyToClipboard(`Email: ${a.email}\nPassword: ${a.password}`)} className="p-2 rounded-lg hover:bg-emerald-50 text-text-tertiary">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-emerald-600 mt-3 font-medium">Share credentials privately with flat owners. This data is shown only once.</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "members", "tenants", "guards", "admins"] as RoleTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === tab ? "bg-primary text-white shadow-sm" : "bg-surface text-text-secondary hover:bg-primary/5"
                }`}
              >
                {tabLabels[tab]}
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab ? "bg-white/20" : "bg-white"}`}>
                  {tabCount(tab)}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              className="input !rounded-xl !bg-surface/50 !border-border/60 !pl-11 pr-4 py-2.5 text-xs sm:text-sm font-semibold w-full"
              placeholder="Search name, email, flat..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="spinner !w-8 !h-8" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/40 bg-surface/30">
                    <th className="px-5 py-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">User</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Flat</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Role</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Login Email</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const style = roleStyles[u.role] || roleStyles.member;
                    return (
                      <tr key={u.id} className="border-b border-border/20 hover:bg-surface/20 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-text-primary">{u.name}</p>
                          {u.phone && <p className="text-[10px] text-text-tertiary mt-0.5">{u.phone}</p>}
                        </td>
                        <td className="px-5 py-4">
                          {u.flat ? (
                            <span className="text-xs font-bold text-text-secondary bg-surface px-2 py-1 rounded-lg">
                              {u.flat.wing ? `${u.flat.wing}-` : ""}
                              {u.flat.flatNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-tertiary">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => copyToClipboard(u.email)} className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                            {u.email} <Copy className="w-3 h-3 opacity-40" />
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[10px] text-text-tertiary">
                            {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <div className="text-center py-16">
                <Users className="w-10 h-10 text-text-tertiary mx-auto mb-4 opacity-20" />
                <p className="text-text-primary font-bold">No accounts found</p>
                <p className="text-xs text-text-secondary mt-1">
                  {search ? "Try a different search term" : 'Click "Auto-Generate" to create resident logins'}
                </p>
              </div>
            )}

            <div className="px-5 pb-5">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                itemLabel="accounts"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
