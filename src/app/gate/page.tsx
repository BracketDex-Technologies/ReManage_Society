"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Camera,
  History,
  Home,
  LogIn,
  LogOut,
  Package,
  Search,
  Shield,
  Truck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { LIVE_FAST_INTERVAL_MS } from "@/lib/live-refresh";
import { isOptionalTenDigitPhone, isTenDigitPhone, phoneInputProps, sanitizePhoneInput } from "@/lib/phone-input";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";

interface GuardSession {
  id: string;
  name: string;
  gateAssignment: string | null;
  societyId: string;
  societyName: string;
  societyAddress: string | null;
}

interface GateStats {
  visitorsIn: number;
  todayVisitors: number;
  expectedVisitors: number;
  pendingApproval: number;
  pendingPackages: number;
  todayStaff: number;
}

interface GateFlat {
  id: string;
  flatNumber: string;
  wing: string | null;
  floor: number | null;
  ownerName: string | null;
  tenantName: string | null;
  currentOccupantName: string | null;
  currentOccupantPhone: string | null;
  currentOccupantRole: string | null;
}

interface GateVisitor {
  id: string;
  flatNumber: string;
  visitorName: string;
  phone: string | null;
  purpose: string;
  vehicleNo: string | null;
  photoUrl: string | null;
  status: string;
  residentResponse: string | null;
  isPreApproved: boolean;
  expectedAt: string | null;
  entryTime: string;
  exitTime: string | null;
  createdAt: string;
  flat?: { flatNumber: string; wing: string | null; ownerName: string | null; tenantName?: string | null; currentOccupantName?: string | null; currentOccupantRole?: string | null } | null;
}

interface GatePackage {
  id: string;
  courierName: string | null;
  description: string | null;
  status: string;
  receivedAt: string;
  collectedAt: string | null;
  pickupOtp: string | null;
  flat: { flatNumber: string; wing: string | null; ownerName: string | null; tenantName?: string | null; currentOccupantName?: string | null; currentOccupantRole?: string | null };
}

type ActiveTab = "visitors" | "staff" | "packages";

const emptyStats: GateStats = {
  visitorsIn: 0,
  todayVisitors: 0,
  expectedVisitors: 0,
  pendingApproval: 0,
  pendingPackages: 0,
  todayStaff: 0,
};

function formatTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GuardGatePage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();

  const duration = (entry?: string | null, exit?: string | null) => {
    if (!entry || !exit) return "";
    const minutes = Math.max(0, Math.round((new Date(exit).getTime() - new Date(entry).getTime()) / 60000));
    if (minutes < 60) return `${minutes} ${t("min")}`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const flatLabel = (flat: Pick<GateFlat, "flatNumber" | "currentOccupantName" | "currentOccupantRole" | "ownerName" | "tenantName">) => {
    const occupant = flat.currentOccupantName || flat.tenantName || flat.ownerName;
    const role = flat.currentOccupantRole
      ? flat.currentOccupantRole.replace("_", " ").toLowerCase()
      : flat.tenantName
        ? t("tenant")
        : flat.ownerName
          ? t("owner")
          : "";
    return `${flat.flatNumber}${occupant ? ` · ${occupant}${role ? ` (${role})` : ""}` : ""}`;
  };

  const [guard, setGuard] = useState<GuardSession | null>(null);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [joinMode, setJoinMode] = useState(false);
  const [joinForm, setJoinForm] = useState({ joinCode: "", name: "", phone: "", pin: "", gateAssignment: "" });
  const [logging, setLogging] = useState(false);
  const [stats, setStats] = useState<GateStats>(emptyStats);
  const [flats, setFlats] = useState<GateFlat[]>([]);
  const [visitors, setVisitors] = useState<GateVisitor[]>([]);
  const [packages, setPackages] = useState<GatePackage[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("visitors");
  const [showHistory, setShowHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [flatSearch, setFlatSearch] = useState("");
  const [vForm, setVForm] = useState({
    flatNumber: "",
    visitorName: "",
    phone: "",
    purpose: "guest",
    vehicleNo: "",
    vehiclePhotoUrl: "",
    entryMode: "approval",
  });
  const [staffCode, setStaffCode] = useState("");
  const [pForm, setPForm] = useState({ flatNumber: "", courierName: "", description: "" });

  useEffect(() => {
    const saved = localStorage.getItem("guard_session");
    if (saved) {
      try {
        setGuard(JSON.parse(saved));
      } catch {
        localStorage.removeItem("guard_session");
      }
    }
  }, []);

  const selectedVisitorFlat = flats.find((flat) => flat.flatNumber === vForm.flatNumber);
  const selectedPackageFlat = flats.find((flat) => flat.flatNumber === pForm.flatNumber);

  const filteredFlats = useMemo(() => {
    const search = flatSearch.trim().toLowerCase();
    if (!search) return flats.slice(0, 20);
    return flats
      .filter((flat) =>
        flat.flatNumber.toLowerCase().includes(search) ||
        (flat.wing || "").toLowerCase().includes(search) ||
        (flat.currentOccupantName || "").toLowerCase().includes(search) ||
        (flat.tenantName || "").toLowerCase().includes(search) ||
        (flat.ownerName || "").toLowerCase().includes(search)
      )
      .slice(0, 30);
  }, [flatSearch, flats]);

  const fetchGateData = useCallback(() => {
    if (!guard) return;
    fetch(`/api/guard/gate?guardId=${guard.id}${showHistory ? "&history=all" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
        if (data.flats) setFlats(data.flats);
        if (data.visitors) setVisitors(data.visitors);
        if (data.packages) setPackages(data.packages);
      })
      .catch(() => {});
  }, [guard, showHistory]);

  useEffect(() => {
    fetchGateData();
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") fetchGateData();
    };
    const interval = window.setInterval(fetchGateData, LIVE_FAST_INTERVAL_MS);
    window.addEventListener("focus", fetchGateData);
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", fetchGateData);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [fetchGateData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTenDigitPhone(phone)) {
      toastT.error("Enter a valid 10-digit phone number");
      return;
    }
    setLogging(true);
    try {
      const res = await fetch("/api/guard/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();
      if (res.ok && data.guard) {
        setGuard(data.guard);
        localStorage.setItem("guard_session", JSON.stringify(data.guard));
        toastT.success(`${t("Welcome,")} ${data.guard.name}`);
      } else {
        toastT.error(data.error || "Login failed");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setLogging(false);
    }
  };

  const handleJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTenDigitPhone(joinForm.phone)) {
      toastT.error("Enter a valid 10-digit phone number");
      return;
    }
    setLogging(true);
    try {
      const res = await fetch("/api/guard/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(joinForm),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(data.message || "Request submitted");
        setJoinMode(false);
        setPhone(joinForm.phone);
      } else {
        toastT.error(data.error || "Could not submit request");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setLogging(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("guard_session");
    setGuard(null);
    toastT.success("Logged out");
  };

  const gateAction = async (action: string, payload: Record<string, string>) => {
    if (!guard) return;
    if (action === "visitor_entry" && !isOptionalTenDigitPhone(payload.phone)) {
      toastT.error("Enter a valid 10-digit visitor phone number");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/guard/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardId: guard.id, action, ...payload }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(data.message || "Done");
        fetchGateData();
        if (action === "visitor_entry") {
          setVForm({ flatNumber: "", visitorName: "", phone: "", purpose: "guest", vehicleNo: "", vehiclePhotoUrl: "", entryMode: "approval" });
          setFlatSearch("");
        }
        if (action === "staff_checkin") setStaffCode("");
        if (action === "log_package") setPForm({ flatNumber: "", courierName: "", description: "" });
      } else {
        toastT.error(data.error || "Failed");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVehiclePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toastT.error("Please capture or select an image");
      return;
    }
    if (file.size > 1_500_000) {
      toastT.error("Vehicle photo must be under 1.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setVForm((current) => ({ ...current, vehiclePhotoUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  if (!guard) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 mb-4">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{t("Gate Console")}</h1>
            <p className="text-sm text-slate-400 mt-1">{t("Security staff login")}</p>
          </div>

          {!joinMode ? (
            <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-5">
              <input {...phoneInputProps} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 text-white font-bold text-sm" placeholder={t("Phone number")} value={phone} onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))} required />
              <input type="password" maxLength={4} inputMode="numeric" className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 text-white font-bold text-2xl text-center tracking-[0.5em]" placeholder={t("PIN")} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required />
              <button type="submit" disabled={logging} className="w-full bg-primary text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" />
                {logging ? t("Logging in...") : t("Login")}
              </button>
              <button type="button" onClick={() => setJoinMode(true)} className="w-full text-slate-300 text-xs font-bold py-2 hover:text-white">
                {t("New guard? Request access with society code")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinRequest} className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-4">
              <input className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm uppercase" placeholder={t("Society join code")} value={joinForm.joinCode} onChange={(e) => setJoinForm({ ...joinForm, joinCode: e.target.value.toUpperCase() })} required />
              <input className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm" placeholder={t("Guard name")} value={joinForm.name} onChange={(e) => setJoinForm({ ...joinForm, name: e.target.value })} required />
              <input {...phoneInputProps} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm" placeholder={t("10-digit phone")} value={joinForm.phone} onChange={(e) => setJoinForm({ ...joinForm, phone: sanitizePhoneInput(e.target.value) })} required />
              <input className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm" placeholder={t("Gate name optional")} value={joinForm.gateAssignment} onChange={(e) => setJoinForm({ ...joinForm, gateAssignment: e.target.value })} />
              <input type="password" maxLength={4} inputMode="numeric" className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-2xl text-center tracking-[0.5em]" placeholder={t("PIN")} value={joinForm.pin} onChange={(e) => setJoinForm({ ...joinForm, pin: e.target.value.replace(/\D/g, "") })} required />
              <button type="submit" disabled={logging} className="w-full bg-primary text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                {t("Request Approval")}
              </button>
              <button type="button" onClick={() => setJoinMode(false)} className="w-full text-slate-300 text-xs font-bold py-2 hover:text-white">
                {t("Back to login")}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const expectedVisitors = visitors.filter((visitor) => visitor.status === "expected");
  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24">
      <div className="bg-primary text-white p-4 safe-top">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{guard.name}</p>
              <p className="text-[10px] text-white/75">{guard.societyName} · {guard.gateAssignment || t("Main Gate")}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-white/10">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { val: stats.visitorsIn, label: "Inside", color: "text-emerald-600" },
            { val: stats.expectedVisitors, label: "Expected", color: "text-blue-600" },
            { val: stats.pendingPackages, label: "Parcels", color: "text-amber-600" },
            { val: stats.pendingApproval, label: "Pending", color: "text-violet-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-3 text-center border border-border/50">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.val}</p>
              <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider mt-0.5">{t(stat.label)}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-white rounded-2xl p-1 border border-border/50">
          {([
            { key: "visitors", label: "Visitor", icon: Users },
            { key: "packages", label: "Package", icon: Package },
            { key: "staff", label: "Staff", icon: UserPlus },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 ${activeTab === tab.key ? "bg-primary text-white shadow-sm" : "text-text-secondary"}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {t(tab.label)}
            </button>
          ))}
        </div>

        <button onClick={() => setShowHistory((value) => !value)} className="w-full bg-white border border-border rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-text-secondary">
          <History className="w-4 h-4" />
          {showHistory ? t("Showing Full Gate History") : t("Today Only")}
        </button>

        {activeTab === "visitors" && (
          <div className="bg-white rounded-2xl p-5 border border-border/50 space-y-4">
            <p className="text-xs font-bold text-text-primary">{t("Log Visitor Entry")}</p>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-tertiary uppercase">{t("Find Flat / Wing / Occupant")}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input className="w-full bg-surface border border-border rounded-xl pl-10 pr-3 py-3 text-xs font-bold" placeholder={t("Search A-203, A wing, tenant or owner")} value={flatSearch} onChange={(e) => setFlatSearch(e.target.value)} />
              </div>
              <select className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" value={vForm.flatNumber} onChange={(e) => setVForm({ ...vForm, flatNumber: e.target.value })}>
                <option value="">{t("Select flat")}</option>
                {filteredFlats.map((flat) => (
                  <option key={flat.id} value={flat.flatNumber}>
                    {flatLabel(flat)}
                  </option>
                ))}
              </select>
              {selectedVisitorFlat && (
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 text-xs text-primary font-bold flex items-start gap-2">
                  <Home className="w-4 h-4" />
                  <div>
                    <p>{selectedVisitorFlat.flatNumber} · {t("Current:")} {selectedVisitorFlat.currentOccupantName || t("Occupant not linked")}{selectedVisitorFlat.currentOccupantRole ? ` (${selectedVisitorFlat.currentOccupantRole.toLowerCase()})` : ""}</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      {t("Owner:")} {selectedVisitorFlat.ownerName || t("Not linked")}{selectedVisitorFlat.tenantName ? ` · ${t("Tenant:")} ${selectedVisitorFlat.tenantName}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input className="bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" placeholder={t("Visitor Name *")} value={vForm.visitorName} onChange={(e) => setVForm({ ...vForm, visitorName: e.target.value })} />
              <input {...phoneInputProps} className="bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" placeholder={t("Phone")} value={vForm.phone} onChange={(e) => setVForm({ ...vForm, phone: sanitizePhoneInput(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" value={vForm.purpose} onChange={(e) => setVForm({ ...vForm, purpose: e.target.value })}>
                <option value="guest">{t("Guest")}</option>
                <option value="delivery">{t("Delivery")}</option>
                <option value="cab">{t("Cab Driver")}</option>
                <option value="service">{t("Service")}</option>
                <option value="other">{t("Other")}</option>
              </select>
              <input className="bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" placeholder={t("Vehicle No")} value={vForm.vehicleNo} onChange={(e) => setVForm({ ...vForm, vehicleNo: e.target.value })} />
            </div>
            <div className="rounded-xl border border-dashed border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{t("Vehicle Photo Optional")}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">{t("Enter vehicle number or capture the plate photo.")}</p>
                </div>
                {!vForm.vehiclePhotoUrl && (
                  <label className="shrink-0 cursor-pointer rounded-xl bg-primary px-3 py-2 text-[10px] font-bold text-white flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    {t("Take Photo")}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleVehiclePhoto(e.target.files?.[0])} />
                  </label>
                )}
              </div>
              {vForm.vehiclePhotoUrl && (
                <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-white">
                  <img src={vForm.vehiclePhotoUrl} alt={t("Vehicle plate preview")} className="h-36 w-full object-cover" />
                  <button type="button" onClick={() => setVForm({ ...vForm, vehiclePhotoUrl: "" })} className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-danger shadow-sm">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setVForm({ ...vForm, entryMode: "approval" })} className={`rounded-xl border p-3 text-xs font-bold ${vForm.entryMode === "approval" ? "border-primary bg-primary/5 text-primary" : "border-border text-text-secondary"}`}>
                {t("Request Approval")}
              </button>
              <button type="button" onClick={() => setVForm({ ...vForm, entryMode: "direct" })} className={`rounded-xl border p-3 text-xs font-bold ${vForm.entryMode === "direct" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border text-text-secondary"}`}>
                {t("Allow Entry Now")}
              </button>
            </div>

            <button onClick={() => gateAction("visitor_entry", vForm)} disabled={!vForm.flatNumber || !vForm.visitorName || actionLoading} className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <ArrowDownLeft className="w-4 h-4" />
              {vForm.entryMode === "direct" ? t("Check In Visitor") : t("Send Approval Request")}
            </button>
          </div>
        )}

        {activeTab === "packages" && (
          <div className="bg-white rounded-2xl p-5 border border-border/50 space-y-4">
            <p className="text-xs font-bold text-text-primary">{t("Log Package")}</p>
            <select className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" value={pForm.flatNumber} onChange={(e) => setPForm({ ...pForm, flatNumber: e.target.value })}>
              <option value="">{t("Select flat")}</option>
              {flats.map((flat) => (
                <option key={flat.id} value={flat.flatNumber}>
                  {flatLabel(flat)}
                </option>
              ))}
            </select>
            {selectedPackageFlat && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700 font-bold flex items-start gap-2">
                <Building2 className="w-4 h-4" />
                <div>
                  <p>{selectedPackageFlat.flatNumber} · {t("Current:")} {selectedPackageFlat.currentOccupantName || t("Occupant not linked")}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {t("Owner:")} {selectedPackageFlat.ownerName || t("Not linked")}{selectedPackageFlat.tenantName ? ` · ${t("Tenant:")} ${selectedPackageFlat.tenantName}` : ""}
                  </p>
                </div>
              </div>
            )}
            <input className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" placeholder={t("Courier (Amazon, Flipkart...)")} value={pForm.courierName} onChange={(e) => setPForm({ ...pForm, courierName: e.target.value })} />
            <input className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-xs font-bold" placeholder={t("Description optional")} value={pForm.description} onChange={(e) => setPForm({ ...pForm, description: e.target.value })} />
            <button onClick={() => gateAction("log_package", pForm)} disabled={!pForm.flatNumber || actionLoading} className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <Truck className="w-4 h-4" />
              {t("Log Package")}
            </button>
          </div>
        )}

        {activeTab === "staff" && (
          <div className="bg-white rounded-2xl p-5 border border-border/50 space-y-4">
            <p className="text-xs font-bold text-text-primary">{t("Staff Check-in / Check-out")}</p>
            <input className="w-full bg-surface border border-border rounded-xl px-4 py-4 font-mono font-bold text-center text-2xl tracking-[0.5em]" placeholder={t("Code")} value={staffCode} onChange={(e) => setStaffCode(e.target.value)} maxLength={6} />
            <button onClick={() => gateAction("staff_checkin", { entryCode: staffCode })} disabled={!staffCode || actionLoading} className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-bold text-xs disabled:opacity-50">
              {t("Mark Staff Entry")}
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 border border-border/50">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-3">{t("Expected / Waiting Visitors")}</p>
          <div className="space-y-2">
            {expectedVisitors.length === 0 ? (
              <p className="text-xs text-text-secondary py-2">{t("No waiting visitors.")}</p>
            ) : expectedVisitors.map((visitor) => (
              <div key={visitor.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface/60 p-3">
                <div>
                  <p className="text-xs font-bold text-text-primary">{visitor.visitorName}</p>
                  <p className="text-[10px] text-text-secondary">{t("Flat")} {visitor.flatNumber} · {visitor.flat?.currentOccupantName || t("Occupant")} · {visitor.purpose}</p>
                  <p className={`text-[10px] font-bold ${visitor.residentResponse === "approved" ? "text-emerald-600" : "text-amber-600"}`}>
                    {visitor.residentResponse === "approved" ? t("Approved for entry") : t("Waiting for resident approval")}
                  </p>
                </div>
                <button onClick={() => gateAction("visitor_checkin", { visitorId: visitor.id })} disabled={visitor.residentResponse !== "approved" || actionLoading} className="bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold text-[10px] disabled:opacity-40">
                  {t("Check In")}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-border/50">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">{showHistory ? t("Visitor Full History") : t("Today's Visitor History")}</p>
          <p className="text-[10px] text-text-secondary mb-3">{showHistory ? t("Older records are preserved here for audit and tracking.") : t("Switch to full history to see previous days.")}</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {visitors.length === 0 ? (
              <p className="text-xs text-text-secondary py-2">{t("No visitor records.")}</p>
            ) : visitors.map((visitor) => (
              <div key={visitor.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-text-primary">{visitor.visitorName}</p>
                    <p className="text-[10px] text-text-secondary">{t("Flat")} {visitor.flatNumber} · {visitor.flat?.currentOccupantName || t("Occupant")} · {visitor.purpose}</p>
                    {visitor.photoUrl && (
                      <img src={visitor.photoUrl} alt={t("Vehicle number photo")} className="mt-2 h-16 w-24 rounded-lg border border-border object-cover" />
                    )}
                  </div>
                  {visitor.status === "in" ? (
                    <button onClick={() => gateAction("visitor_exit", { visitorId: visitor.id })} disabled={actionLoading} className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold text-[10px]">
                      {t("Mark Exit")}
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-text-secondary uppercase">{visitor.status}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-text-secondary">
                  {visitor.status === "expected" ? (
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3" />
                      {t("Requested")} {formatDateTime(visitor.createdAt)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <ArrowDownLeft className="w-3 h-3" />
                      {t("In")} {formatDateTime(visitor.entryTime)}
                    </span>
                  )}
                  {visitor.exitTime && <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {t("Out")} {formatTime(visitor.exitTime)}</span>}
                  {visitor.exitTime && <span>{duration(visitor.entryTime, visitor.exitTime)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-border/50">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">{showHistory ? t("Parcel Full History") : t("Today's Parcel History")}</p>
          <p className="text-[10px] text-text-secondary mb-3">{showHistory ? t("All parcel records are retained for tracking.") : t("Switch to full history to see previous days.")}</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {packages.length === 0 ? (
              <p className="text-xs text-text-secondary py-2">{t("No parcel records.")}</p>
            ) : packages.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-text-primary">{pkg.courierName || t("Package")}</p>
                    <p className="text-[10px] text-text-secondary">
                      {t("Flat")} {pkg.flat.flatNumber} · {pkg.flat.currentOccupantName || pkg.flat.tenantName || pkg.flat.ownerName || t("Occupant not linked")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] font-bold text-amber-700 uppercase">{pkg.status}</span>
                    {pkg.status === "received" && (
                      <button
                        onClick={() => gateAction("package_collected", { packageId: pkg.id })}
                        disabled={actionLoading}
                        className="bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold text-[10px]"
                      >
                        {t("Mark Collected")}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-text-secondary mt-2">
                  {t("Received")} {formatDateTime(pkg.receivedAt)}
                  {pkg.collectedAt ? ` · ${t("Collected")} ${formatDateTime(pkg.collectedAt)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
