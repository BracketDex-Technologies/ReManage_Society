"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Eye,
  EyeOff,
  IndianRupee,
  KeyRound,
  LogOut,
  Power,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

type PortalAdmin = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type SocietyRow = {
  id: string;
  name: string;
  joinCode: string | null;
  city: string;
  pincode: string;
  planTier: string;
  accessDisabledAt: string | null;
  accessDisableReason: string | null;
  createdAt: string;
  chairman: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
  } | null;
  totalFlats: number;
  totalUsers: number;
  stats: {
    totalCollected: number;
    pendingAmount: number;
    totalExpenses: number;
    balance: number;
  };
};

type PortalStatus = {
  hasPortalAdmins: boolean;
  admin: PortalAdmin | null;
};

type SocietyPayload = {
  societies: SocietyRow[];
  totals: {
    societyCount: number;
    totalCollected: number;
    pendingAmount: number;
    totalExpenses: number;
    balance: number;
  };
};

const emptyCredentials = { name: "", email: "", password: "" };

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function RegisteredSocietyPage() {
  const [bootLoading, setBootLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [payload, setPayload] = useState<SocietyPayload | null>(null);
  const [admins, setAdmins] = useState<PortalAdmin[]>([]);
  const [authForm, setAuthForm] = useState(emptyCredentials);
  const [partnerForm, setPartnerForm] = useState(emptyCredentials);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<{
    societyName: string;
    chairmanEmail: string;
    password: string;
  } | null>(null);

  const isAuthenticated = Boolean(status?.admin);
  const isFirstAdmin = status ? !status.hasPortalAdmins : false;

  const filteredAdmins = useMemo(() => admins.filter((admin) => admin.email), [admins]);

  async function parseJson(res: Response) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  async function loadStatus() {
    const res = await fetch("/api/portal/auth/status", { cache: "no-store" });
    const data = await parseJson(res);
    setStatus(data);
    return data as PortalStatus;
  }

  async function loadDashboard() {
    const [societyRes, adminRes] = await Promise.all([
      fetch("/api/portal/registered-societies", { cache: "no-store" }),
      fetch("/api/portal/admins", { cache: "no-store" }),
    ]);
    const societyData = await parseJson(societyRes);
    const adminData = await parseJson(adminRes);
    setPayload(societyData);
    setAdmins(adminData.admins || []);
  }

  async function bootstrap() {
    setBootLoading(true);
    setError("");
    try {
      const nextStatus = await loadStatus();
      if (nextStatus.admin) {
        await loadDashboard();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load portal");
    } finally {
      setBootLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const endpoint = isFirstAdmin ? "/api/portal/auth/register" : "/api/portal/auth/login";
      await parseJson(await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      }));
      setAuthForm(emptyCredentials);
      setMessage(isFirstAdmin ? "Portal owner created." : "Logged in.");
      await bootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePartnerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await parseJson(await fetch("/api/portal/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partnerForm),
      }));
      setPartnerForm(emptyCredentials);
      setMessage("Partner credentials created.");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create partner");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetChairmanPassword(society: SocietyRow) {
    setLoading(true);
    setError("");
    setMessage("");
    setTemporaryPassword(null);
    try {
      const data = await parseJson(await fetch(`/api/portal/societies/${society.id}/chairman-password`, {
        method: "POST",
      }));
      setTemporaryPassword({
        societyName: data.society.name,
        chairmanEmail: data.chairman.email,
        password: data.temporaryPassword,
      });
      setMessage("Temporary password generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSociety(society: SocietyRow) {
    const confirmationName = window.prompt(`Type "${society.name}" to delete this society.`);
    if (confirmationName === null) return;

    setLoading(true);
    setError("");
    setMessage("");
    setTemporaryPassword(null);
    try {
      await parseJson(await fetch(`/api/portal/societies/${society.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName }),
      }));
      setMessage(`${society.name} deleted from registered societies.`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete society");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleSocietyAccess(society: SocietyRow) {
    const disabled = !society.accessDisabledAt;
    const reason = disabled
      ? window.prompt(`Why disable access for "${society.name}"?`, "Subscription payment pending")
      : "";
    if (disabled && reason === null) return;

    setLoading(true);
    setError("");
    setMessage("");
    setTemporaryPassword(null);
    try {
      await parseJson(await fetch(`/api/portal/societies/${society.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled, reason }),
      }));
      setMessage(`${society.name} ${disabled ? "disabled" : "enabled"}.`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update society access");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    setPayload(null);
    setAdmins([]);
    setStatus({ hasPortalAdmins: true, admin: null });
  }

  if (bootLoading) {
    return (
      <main className="min-h-screen bg-surface px-4 py-8">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center">
          <div className="spinner" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-surface px-4 py-8">
        <section className="mx-auto flex min-h-[80vh] max-w-md items-center">
          <div className="w-full">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary">Registered Society Portal</h1>
              <p className="mt-1 text-sm text-text-secondary">
                {isFirstAdmin ? "Create the first portal owner account" : "Portal owner and partner access"}
              </p>
            </div>

            <div className="card">
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isFirstAdmin && (
                  <div className="form-group !mb-0">
                    <label className="label" htmlFor="portal-name">Name *</label>
                    <input
                      id="portal-name"
                      className="input"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="form-group !mb-0">
                  <label className="label" htmlFor="portal-email">Email *</label>
                  <input
                    id="portal-email"
                    type="email"
                    className="input"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group !mb-0">
                  <label className="label" htmlFor="portal-password">Password *</label>
                  <div className="relative">
                    <input
                      id="portal-password"
                      type={showPassword ? "text" : "password"}
                      className="input pr-10"
                      minLength={6}
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                      className="input-icon-button absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm font-medium text-danger">{error}</p>}
                {message && <p className="text-sm font-medium text-success">{message}</p>}

                <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
                  {loading ? <div className="spinner !h-5 !w-5 !border-white/30 !border-t-white" /> : isFirstAdmin ? "Create Owner Account" : "Log In"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">Portal Owner</p>
            <h1 className="text-2xl font-bold text-text-primary">Registered Societies</h1>
            <p className="text-sm text-text-secondary">Signed in as {status?.admin?.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/register" className="btn btn-primary">
              <Building2 className="h-4 w-4" />
              Create Society
            </a>
            <button type="button" className="btn btn-secondary" onClick={bootstrap} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        {(error || message || temporaryPassword) && (
          <section className="rounded-lg border border-border bg-card p-4">
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            {message && <p className="text-sm font-medium text-success">{message}</p>}
            {temporaryPassword && (
              <div className="mt-3 grid gap-2 rounded-md bg-surface p-3 text-sm text-text-primary md:grid-cols-3">
                <span><strong>Society:</strong> {temporaryPassword.societyName}</span>
                <span><strong>Chairman:</strong> {temporaryPassword.chairmanEmail}</span>
                <span><strong>Password:</strong> <code>{temporaryPassword.password}</code></span>
              </div>
            )}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryTile icon={<Building2 className="h-5 w-5" />} label="Societies" value={String(payload?.totals.societyCount || 0)} />
          <SummaryTile icon={<IndianRupee className="h-5 w-5" />} label="Collected" value={money(payload?.totals.totalCollected || 0)} />
          <SummaryTile icon={<IndianRupee className="h-5 w-5" />} label="Pending" value={money(payload?.totals.pendingAmount || 0)} />
          <SummaryTile icon={<IndianRupee className="h-5 w-5" />} label="Expenses" value={money(payload?.totals.totalExpenses || 0)} />
          <SummaryTile icon={<IndianRupee className="h-5 w-5" />} label="Balance" value={money(payload?.totals.balance || 0)} />
        </section>

        <section className="space-y-6">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-text-primary">Society List</h2>
              <span className="text-sm text-text-secondary">{payload?.societies.length || 0} registered</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Society</th>
                    <th className="px-4 py-3">Chairman</th>
                    <th className="px-4 py-3">Flats / Users</th>
                    <th className="px-4 py-3">Collected</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(payload?.societies || []).map((society) => (
                    <tr key={society.id} className="text-text-primary">
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold">{society.name}</div>
                        <div className="text-xs text-text-secondary">
                          {society.city} {society.pincode} · Code {society.joinCode || "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium">{society.chairman?.name || "Not assigned"}</div>
                        <div className="text-xs text-text-secondary">{society.chairman?.email || "No email"}</div>
                        {society.chairman?.phone && <div className="text-xs text-text-secondary">{society.chairman.phone}</div>}
                      </td>
                      <td className="px-4 py-4 align-top">{society.totalFlats} / {society.totalUsers}</td>
                      <td className="px-4 py-4 align-top font-medium">{money(society.stats.totalCollected)}</td>
                      <td className="px-4 py-4 align-top font-medium text-warning">{money(society.stats.pendingAmount)}</td>
                      <td className="px-4 py-4 align-top font-medium">{money(society.stats.balance)}</td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${society.accessDisabledAt ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                          {society.accessDisabledAt ? "Disabled" : "Active"}
                        </span>
                        {society.accessDisableReason && (
                          <div className="mt-1 max-w-40 text-xs text-text-secondary">{society.accessDisableReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">{dateLabel(society.createdAt)}</td>
                      <td className="px-4 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={`btn btn-secondary btn-sm ${society.accessDisabledAt ? "text-success" : "text-warning"}`}
                            onClick={() => handleToggleSocietyAccess(society)}
                            disabled={loading}
                          >
                            {society.accessDisabledAt ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                            {society.accessDisabledAt ? "Enable" : "Disable"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetChairmanPassword(society)}
                            disabled={loading || !society.chairman}
                          >
                            <KeyRound className="h-4 w-4" />
                            Temp Password
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm text-danger"
                            onClick={() => handleDeleteSociety(society)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {payload?.societies.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-text-secondary" colSpan={9}>
                        No societies registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-text-primary">Create Partner</h2>
              </div>
              <form onSubmit={handlePartnerSubmit} className="space-y-3">
                <input
                  className="input"
                  placeholder="Partner name"
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  required
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Partner email"
                  value={partnerForm.email}
                  onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                  required
                />
                <input
                  className="input"
                  type="password"
                  minLength={6}
                  placeholder="Password"
                  value={partnerForm.password}
                  onChange={(e) => setPartnerForm({ ...partnerForm, password: e.target.value })}
                  required
                />
                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  <UserPlus className="h-4 w-4" />
                  Create Credentials
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-text-primary">Portal Users</h2>
              </div>
              <div className="space-y-3">
                {filteredAdmins.map((admin) => (
                  <div key={admin.id} className="rounded-md bg-surface p-3">
                    <div className="font-medium text-text-primary">{admin.name}</div>
                    <div className="text-xs text-text-secondary">{admin.email}</div>
                    <div className="mt-1 text-xs font-semibold uppercase text-primary">{admin.role}</div>
                  </div>
                ))}
                {filteredAdmins.length === 0 && (
                  <p className="rounded-md bg-surface p-3 text-sm text-text-secondary">
                    No portal users yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="mt-1 break-words text-xl font-bold text-text-primary">{value}</div>
    </div>
  );
}
