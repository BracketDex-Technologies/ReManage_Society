"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Settings as SettingsIcon, Save, Shield, Building2, Home, Copy, Plus, RefreshCw, UserCheck, Mail, Phone, X } from "lucide-react";

interface FlatLinkedUser {
  id: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
}

interface FlatSetupItem {
  id: string;
  flatNumber: string;
  wing: string | null;
  floor: number | null;
  ownerName: string | null;
  contact: string | null;
  isActive: boolean;
  hasAccount: boolean;
  tenantName?: string | null;
  users: FlatLinkedUser[];
}

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flatsLoading, setFlatsLoading] = useState(false);
  const [flatsSaving, setFlatsSaving] = useState(false);
  const [tab, setTab] = useState<"profile" | "flats" | "guards" | "roles">("profile");
  const [joinCode, setJoinCode] = useState("");
  const [flats, setFlats] = useState<FlatSetupItem[]>([]);
  const [selectedFlat, setSelectedFlat] = useState<FlatSetupItem | null>(null);
  const [guards, setGuards] = useState<GuardItem[]>([]);
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [guardSaving, setGuardSaving] = useState(false);
  const [flatSetup, setFlatSetup] = useState({
    wings: "A",
    floors: "1,2,3,4",
    flatsPerFloor: "4",
  });
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
      .catch(() => toast.error("Failed to load flats"))
      .finally(() => setFlatsLoading(false));
  };

  const fetchGuards = () => {
    setGuardsLoading(true);
    fetch("/api/guard")
      .then((r) => r.json())
      .then((d) => setGuards(d.guards || []))
      .catch(() => toast.error("Failed to load guards"))
      .finally(() => setGuardsLoading(false));
  };

  useEffect(() => {
    fetchFlats();
    fetchGuards();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/maintenance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const copyJoinCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode);
    toast.success("Join code copied");
  };

  const createFlats = async () => {
    setFlatsSaving(true);
    try {
      const res = await fetch("/api/settings/flats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flatSetup),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Created ${data.created} flats${data.skipped ? `, skipped ${data.skipped}` : ""}`);
        fetchFlats();
      } else {
        toast.error(data.error || "Failed to create flats");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setFlatsSaving(false);
    }
  };

  const createGuard = async () => {
    setGuardSaving(true);
    try {
      const res = await fetch("/api/guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guardForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.loginCredentials ? `Guard created. Temporary login: ${data.loginCredentials.email}` : "Guard created");
        setGuardForm({ name: "", phone: "", pin: "", gateAssignment: "", shiftStart: "", shiftEnd: "" });
        fetchGuards();
      } else {
        toast.error(data.error || "Failed to create guard");
      }
    } catch {
      toast.error("Something went wrong");
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
        toast.success(isActive ? "Guard approved" : "Guard paused");
        fetchGuards();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update guard");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const previewFlats = () => {
    const wings = flatSetup.wings.split(",").map((w) => w.trim().toUpperCase()).filter(Boolean);
    const floors = flatSetup.floors.split(",").map((f) => Number(f.trim())).filter(Number.isFinite);
    const count = Number(flatSetup.flatsPerFloor || 0);
    const preview: string[] = [];
    for (const wing of wings.slice(0, 2)) {
      for (const floor of floors.slice(0, 2)) {
        for (let unit = 1; unit <= Math.min(count, 4); unit++) {
          preview.push(`${wing}-${floor}${String(unit).padStart(2, "0")}`);
        }
      }
    }
    return preview;
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
            <h1 className="page-title">Settings</h1>
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
                      placeholder="+91..."
                      value={form.legalAdviserPhone}
                      onChange={(e) => setForm({ ...form, legalAdviserPhone: e.target.value })}
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
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Home className="w-4 h-4 text-primary" />
                  Flat Inventory
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Create flats first, then share the join code with residents.
                </p>
              </div>
              <button onClick={fetchFlats} className="btn btn-secondary btn-sm">
                <RefreshCw className={`w-4 h-4 ${flatsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Wings / Blocks</label>
                <input className="input" placeholder="A,B,C or A1,A2" value={flatSetup.wings} onChange={(e) => setFlatSetup({ ...flatSetup, wings: e.target.value })} />
              </div>
              <div>
                <label className="label">Floors</label>
                <input className="input" placeholder="1,2,3,4" value={flatSetup.floors} onChange={(e) => setFlatSetup({ ...flatSetup, floors: e.target.value })} />
              </div>
              <div>
                <label className="label">Flats Per Floor</label>
                <input type="number" min="1" className="input" value={flatSetup.flatsPerFloor} onChange={(e) => setFlatSetup({ ...flatSetup, flatsPerFloor: e.target.value })} />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-surface border border-border">
              <p className="text-xs font-semibold text-text-secondary mb-2">Preview</p>
              <div className="flex flex-wrap gap-2">
                {previewFlats().map((flat) => (
                  <span key={flat} className="px-2 py-1 rounded-md bg-white border border-border text-xs font-bold text-text-primary">
                    {flat}
                  </span>
                ))}
              </div>
            </div>

            <button onClick={createFlats} disabled={flatsSaving} className="btn btn-primary mt-4">
              {flatsSaving ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : <Plus className="w-4 h-4" />}
              Create Missing Flats
            </button>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Current Flats</h3>
              <span className="text-xs text-text-secondary">{flats.length} flats</span>
            </div>
            {flats.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl">
                <Home className="w-8 h-8 mx-auto text-text-tertiary opacity-40 mb-3" />
                <p className="text-sm font-medium text-text-primary">No flats created yet</p>
                <p className="text-xs text-text-secondary mt-1">Use the generator above to create the flat master.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {flats.map((flat) => (
                  <button
                    key={flat.id}
                    type="button"
                    onClick={() => flat.hasAccount && setSelectedFlat(flat)}
                    className={`rounded-lg border p-3 bg-white text-left transition-colors ${
                      flat.hasAccount
                        ? "border-primary/20 hover:border-primary hover:bg-primary/5 cursor-pointer"
                        : "border-border cursor-default"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary">{flat.flatNumber}</p>
                        {flat.hasAccount ? (
                          <>
                            <p className="text-[11px] font-semibold text-text-primary mt-1 truncate">
                              {flat.ownerName || flat.users[0]?.name || "Linked resident"}
                            </p>
                            <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                              {flat.contact || flat.users[0]?.phone || flat.users[0]?.email || "Contact not added"}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-text-secondary mt-1">Available to join</p>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 ${
                        flat.hasAccount ? "bg-success-bg text-success" : "bg-surface text-text-secondary"
                      }`}>
                        {flat.hasAccount ? "Linked" : "Open"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
                <input className="input" maxLength={10} value={guardForm.phone} onChange={(e) => setGuardForm({ ...guardForm, phone: e.target.value.replace(/\D/g, "") })} />
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

      {selectedFlat && (
        <div className="modal-overlay" onClick={() => setSelectedFlat(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Flat Details</p>
                <h3 className="text-xl font-black text-text-primary mt-1">{selectedFlat.flatNumber}</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Wing {selectedFlat.wing || "-"} {selectedFlat.floor ? `· Floor ${selectedFlat.floor}` : ""}
                </p>
              </div>
              <button onClick={() => setSelectedFlat(null)} className="p-2 rounded-lg hover:bg-surface text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedFlat.users.length > 0 ? (
                selectedFlat.users.map((resident) => (
                  <div key={resident.id} className="rounded-xl border border-border p-4 bg-surface/40">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-bold text-text-primary">{resident.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{resident.role}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-success-bg text-success">
                        Account linked
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Mail className="w-4 h-4 text-text-tertiary" />
                        <span className="font-medium text-text-primary break-all">{resident.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Phone className="w-4 h-4 text-text-tertiary" />
                        <span className="font-medium text-text-primary">{resident.phone || "Phone not added"}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <Home className="w-8 h-8 mx-auto text-text-tertiary opacity-40 mb-2" />
                  <p className="text-sm font-medium text-text-primary">No account linked yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
