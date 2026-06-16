"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, Shield, Building2, Home, Copy, Plus, RefreshCw, UserCheck, Phone } from "lucide-react";
import FlatSetupSection, { type FlatSetupItem } from "@/components/settings/FlatSetupSection";
import { isOptionalTenDigitPhone, isTenDigitPhone, phoneInputProps, sanitizePhoneInput } from "@/lib/phone-input";

interface GuardItem {
  id: string;
  name: string;
  phone: string;
  gateAssignment: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  isActive: boolean;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flatsLoading, setFlatsLoading] = useState(false);
  const [tab, setTab] = useState<"profile" | "flats" | "guards" | "roles">("profile");
  const [joinCode, setJoinCode] = useState("");
  const [flats, setFlats] = useState<FlatSetupItem[]>([]);
  const [guards, setGuards] = useState<GuardItem[]>([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [guardSaving, setGuardSaving] = useState(false);
  const [guardForm, setGuardForm] = useState({
    name: "",
    phone: "",
    pin: "",
    gateAssignment: "",
    shiftStart: "",
    shiftEnd: "",
  });
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    pincode: "",
    upiId: "",
    bankDetails: "",
    maintenanceAmt: "",
    dueDayOfMonth: "10",
    lateFee: "",
    legalAdviserName: "",
    legalAdviserPhone: "",
  });

  useEffect(() => {
    fetch("/api/maintenance/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.society) {
          setJoinCode(d.society.joinCode || "");
          setForm({
            name: d.society.name || "",
            address: d.society.address || "",
            city: d.society.city || "",
            pincode: d.society.pincode || "",
            upiId: d.society.upiId || "",
            bankDetails: d.society.bankDetails || "",
            maintenanceAmt: d.society.maintenanceAmt?.toString() || "",
            dueDayOfMonth: d.society.dueDayOfMonth?.toString() || "10",
            lateFee: d.society.lateFee?.toString() || "",
            legalAdviserName: d.society.legalAdviserName || "",
            legalAdviserPhone: d.society.legalAdviserPhone || "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchFlats = () => {
    setFlatsLoading(true);
    fetch("/api/settings/flats")
      .then((r) => r.json())
      .then((d) => setFlats(d.flats || []))
      .catch(() => toastT.error("Failed to load flats"))
      .finally(() => setFlatsLoading(false));
  };

  const fetchGuards = () => {
    setGuardsLoading(true);
    fetch("/api/guard")
      .then((r) => r.json())
      .then((d) => setGuards(d.guards || []))
      .catch(() => toastT.error("Failed to load guards"))
      .finally(() => setGuardsLoading(false));
  };

  useEffect(() => {
    fetchFlats();
    fetchGuards();
  }, []);

  const handleSave = async () => {
    if (!isOptionalTenDigitPhone(form.legalAdviserPhone)) {
      toastT.error("Enter a valid 10-digit legal adviser phone number");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/maintenance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toastT.success("Settings saved successfully");
      } else {
        toastT.error("Failed to save settings");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const copyJoinCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode);
    toastT.success("Join code copied");
  };

  const createGuard = async () => {
    if (!isTenDigitPhone(guardForm.phone)) {
      toastT.error("Enter a valid 10-digit guard phone number");
      return;
    }
    setGuardSaving(true);
    try {
      const res = await fetch("/api/guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guardForm),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(data.loginCredentials ? `Guard created. Temporary login: ${data.loginCredentials.email}` : "Guard created");
        setGuardForm({ name: "", phone: "", pin: "", gateAssignment: "", shiftStart: "", shiftEnd: "" });
        fetchGuards();
      } else {
        toastT.error(data.error || "Failed to create guard");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setGuardSaving(false);
    }
  };

  const updateGuard = async (guardId: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/guard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardId, isActive }),
      });
      if (res.ok) {
        toastT.success(isActive ? "Guard approved" : "Guard paused");
        fetchGuards();
      } else {
        const data = await res.json();
        toastT.error(data.error || "Failed to update guard");
      }
    } catch {
      toastT.error("Something went wrong");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title">{t("Settings")}</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Configure society profile, flats, gate staff, and access
            </p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-lg p-0.5 mb-6 w-fit">
        {([
          { id: "profile" as const, label: "Society Profile", icon: Building2 },
          { id: "flats" as const, label: "Flat Setup", icon: Home },
          { id: "guards" as const, label: "Gate Staff", icon: UserCheck },
          { id: "roles" as const, label: "Roles & Access", icon: Shield },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              tab === t.id ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <div className="space-y-6">
          {joinCode && (
            <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-primary">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Copy className="w-4 h-4 text-primary" />
                  Society Join Code
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Share this only after flats are created. Residents will use it on /join.
                </p>
              </div>
              <button onClick={copyJoinCode} className="btn btn-secondary !font-mono !text-lg !font-black tracking-widest">
                {joinCode}
                <Copy className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="card">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Society Profile
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Society Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Full Address *</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">City *</label>
                  <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="label">Pincode *</label>
                  <input className="input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </div>
              </div>
              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Payment Details</h4>
                <div className="space-y-3">
                  <div>
                    <label className="label">UPI ID</label>
                    <input className="input" placeholder="yourname@upi" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
                    <p className="text-xs text-text-secondary mt-1">Shown on receipts for easy payment</p>
                  </div>
                  <div>
                    <label className="label">Bank Details</label>
                    <input className="input" placeholder="Bank A/C & IFSC for NEFT" value={form.bankDetails} onChange={(e) => setForm({ ...form, bankDetails: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Legal Adviser Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Adviser Name</label>
                    <input
                      className="input"
                      placeholder="Adv. Name"
                      value={form.legalAdviserName}
                      onChange={(e) => setForm({ ...form, legalAdviserName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Call Number</label>
                    <input
                      className="input"
                      placeholder="10-digit phone"
                      {...phoneInputProps}
                      value={form.legalAdviserPhone}
                      onChange={(e) => setForm({ ...form, legalAdviserPhone: sanitizePhoneInput(e.target.value) })}
                    />
                  </div>
                </div>
                <p className="text-xs text-text-secondary mt-2">
                  This appears as a floating call button for residents, committee members, and guards. It is only a click-to-call contact, not a chatbot.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : tab === "flats" ? (
        <FlatSetupSection flats={flats} flatsLoading={flatsLoading} onRefresh={fetchFlats} />
      ) : tab === "guards" ? (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  Gate Staff
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Optional for societies with guards. Guards can be created here or request access from /gate using the join code.
                </p>
              </div>
              <button onClick={fetchGuards} className="btn btn-secondary btn-sm">
                <RefreshCw className={`w-4 h-4 ${guardsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Guard Name</label>
                <input className="input" value={guardForm.name} onChange={(e) => setGuardForm({ ...guardForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input {...phoneInputProps} className="input" value={guardForm.phone} onChange={(e) => setGuardForm({ ...guardForm, phone: sanitizePhoneInput(e.target.value) })} />
              </div>
              <div>
                <label className="label">4-digit PIN</label>
                <input className="input" maxLength={4} value={guardForm.pin} onChange={(e) => setGuardForm({ ...guardForm, pin: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div>
                <label className="label">Gate / Duty Point</label>
                <input className="input" placeholder="Main Gate" value={guardForm.gateAssignment} onChange={(e) => setGuardForm({ ...guardForm, gateAssignment: e.target.value })} />
              </div>
              <div>
                <label className="label">Shift Start</label>
                <input type="time" className="input" value={guardForm.shiftStart} onChange={(e) => setGuardForm({ ...guardForm, shiftStart: e.target.value })} />
              </div>
              <div>
                <label className="label">Shift End</label>
                <input type="time" className="input" value={guardForm.shiftEnd} onChange={(e) => setGuardForm({ ...guardForm, shiftEnd: e.target.value })} />
              </div>
            </div>

            <button onClick={createGuard} disabled={guardSaving} className="btn btn-primary mt-4">
              {guardSaving ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : <Plus className="w-4 h-4" />}
              Create Guard
            </button>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Current Gate Staff</h3>
              <span className="text-xs text-text-secondary">{guards.length} records</span>
            </div>
            {guards.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl">
                <UserCheck className="w-8 h-8 mx-auto text-text-tertiary opacity-40 mb-3" />
                <p className="text-sm font-medium text-text-primary">No guards configured</p>
                <p className="text-xs text-text-secondary mt-1">Small societies can leave this empty.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {guards.map((guard) => (
                  <div key={guard.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border p-4">
                    <div>
                      <p className="text-sm font-bold text-text-primary">{guard.name}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        {guard.phone} · {guard.gateAssignment || "Gate not assigned"}
                        {guard.shiftStart && guard.shiftEnd ? ` · ${guard.shiftStart}-${guard.shiftEnd}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${guard.isActive ? "bg-success-bg text-success-text" : "bg-warning-bg text-warning-text"}`}>
                        {guard.isActive ? "Active" : "Pending / Paused"}
                      </span>
                      <button onClick={() => updateGuard(guard.id, !guard.isActive)} className="btn btn-secondary btn-sm">
                        {guard.isActive ? "Pause" : "Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Role Permissions
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            Each user has a role that determines what they can access. Roles are assigned during user registration.
          </p>
          <div className="table-wrapper !border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th className="text-center">Chairman</th>
                  <th className="text-center">Secretary</th>
                  <th className="text-center">Treasurer</th>
                  <th className="text-center">Member</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { module: "Dashboard", c: true, s: true, t: true, m: true },
                  { module: "Members & Flats", c: true, s: true, t: true, m: false },
                  { module: "Maintenance Bills", c: true, s: true, t: true, m: true },
                  { module: "Expenses", c: true, s: true, t: true, m: false },
                  { module: "Reports", c: true, s: true, t: true, m: false },
                  { module: "Notices", c: true, s: true, t: true, m: true },
                  { module: "Complaints", c: true, s: true, t: true, m: true },
                  { module: "Reminders", c: true, s: true, t: true, m: false },
                  { module: "Visitors", c: true, s: true, t: true, m: true },
                  { module: "Parking", c: true, s: true, t: true, m: true },
                  { module: "Facilities", c: true, s: true, t: true, m: true },
                  { module: "Polls", c: true, s: true, t: true, m: true },
                  { module: "Documents", c: true, s: true, t: true, m: true },
                  { module: "Activity Log", c: true, s: true, t: true, m: false },
                  { module: "Settings", c: true, s: false, t: false, m: false },
                ].map(({ module, c, s, t, m }) => (
                  <tr key={module}>
                    <td className="font-medium text-sm">{module}</td>
                    {[c, s, t, m].map((has, i) => (
                      <td key={i} className="text-center">
                        <span className={`inline-block w-5 h-5 rounded-full ${has ? "bg-success-bg text-success" : "bg-border text-text-secondary"} text-xs flex items-center justify-center mx-auto`}>
                          {has ? "✓" : "–"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
