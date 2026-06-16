"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Eye, EyeOff, Search } from "lucide-react";
import { isOptionalTenDigitPhone, isTenDigitPhone, phoneInputProps, sanitizePhoneInput } from "@/lib/phone-input";

const RELATIONSHIP_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "TENANT", label: "Tenant" },
  { value: "CO_OWNER", label: "Co-owner" },
  { value: "FAMILY_MEMBER", label: "Family Member" },
] as const;

interface SocietyLookup {
  society: {
    id: string;
    name: string;
    address: string;
    city: string;
    pincode: string;
  };
  flats: Array<{
    id: string;
    unitId: string;
    flatNumber: string;
    wing: string | null;
    floor: number | null;
    ownerName: string | null;
    ownerPhone: string | null;
    ownerEmail: string | null;
    tenantName: string | null;
    tenantPhone: string | null;
    occupancyStatus: string;
    ownershipStatus: string;
    billingStatus: string;
    primaryOccupant: string | null;
    hasMember: boolean;
    hasTenant: boolean;
  }>;
}

export default function JoinPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const router = useRouter();
  const [lookupLoading, setLookupLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [lookup, setLookup] = useState<SocietyLookup | null>(null);
  const [flatSearch, setFlatSearch] = useState("");
  const [form, setForm] = useState({
    flatId: "",
    unitId: "",
    relationshipType: "OWNER",
    moveInDate: "",
    agreementEndDate: "",
    emergencyContact: "",
    vehicleCount: "0",
    isPrimaryOccupant: true,
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const selectedFlat = useMemo(
    () => lookup?.flats.find((flat) => flat.id === form.flatId || flat.unitId === form.unitId) || null,
    [form.flatId, form.unitId, lookup]
  );

  const flats = useMemo(() => {
    const search = flatSearch.trim().toLowerCase();
    if (!lookup) return [];
    return lookup.flats.filter((flat) => {
      const matchesSearch =
        !search ||
        flat.flatNumber.toLowerCase().includes(search) ||
        (flat.ownerName || "").toLowerCase().includes(search) ||
        (flat.wing || "").toLowerCase().includes(search);
      const roleAvailable =
        form.relationshipType === "TENANT"
          ? !flat.hasTenant
          : form.relationshipType === "OWNER"
            ? !flat.hasMember
            : true;
      return matchesSearch && roleAvailable;
    });
  }, [flatSearch, form.relationshipType, lookup]);

  const verifyCode = async () => {
    if (!joinCode.trim()) {
      toastT.error("Enter your society join code");
      return;
    }

    setLookupLoading(true);
    setLookup(null);
    setForm((current) => ({ ...current, flatId: "", unitId: "" }));

    try {
      const res = await fetch(`/api/societies/join-code?code=${encodeURIComponent(joinCode)}`);
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Invalid join code");
        return;
      }
      setLookup(data);
      toastT.success("Society found");
    } catch {
      toastT.error("Could not verify join code");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup) {
      toastT.error("Verify your join code first");
      return;
    }
    if (!isOptionalTenDigitPhone(form.emergencyContact)) {
      toastT.error("Enter a valid 10-digit emergency contact number");
      return;
    }
    if (!isTenDigitPhone(form.phone)) {
      toastT.error("Enter a valid 10-digit phone number");
      return;
    }

    setJoining(true);
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, joinCode }),
      });
      const data = await res.json();

      if (res.ok) {
        toastT.success("Joined society successfully");
        router.push("/dashboard");
        router.refresh();
      } else {
        toastT.error(data.error || "Could not join society");
      }
    } catch {
      toastT.error("Something went wrong — please try again");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{t("Join Society")}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {t("Use the join code shared by your chairman or committee")}
          </p>
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <label htmlFor="joinCode" className="label">{t("Join Code")}</label>
              <input
                id="joinCode"
                className="input uppercase"
                placeholder="JOIN1234"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </div>
            <button
              type="button"
              onClick={verifyCode}
              disabled={lookupLoading}
              className="btn btn-primary sm:self-end h-11"
            >
              {lookupLoading ? (
                <div className="spinner !w-5 !h-5 !border-white/30 !border-t-white" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  {t("Verify")}
                </>
              )}
            </button>
          </div>

          {lookup && (
            <form onSubmit={handleSubmit}>
              <div className="p-4 rounded-xl bg-surface border border-border mb-6">
                <h2 className="font-semibold text-text-primary">{lookup.society.name}</h2>
                <p className="text-sm text-text-secondary mt-1">
                  {lookup.society.address}, {lookup.society.city} - {lookup.society.pincode}
                </p>
              </div>

              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
                Flat & Role
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="form-group !mb-0">
                  <label htmlFor="relationshipType" className="label">Relationship *</label>
                  <select
                    id="relationshipType"
                    className="input"
                    value={form.relationshipType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        relationshipType: e.target.value,
                        flatId: "",
                        unitId: "",
                        agreementEndDate: e.target.value === "TENANT" ? form.agreementEndDate : "",
                      })
                    }
                    required
                  >
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{t(option.label)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group !mb-0">
                  <label htmlFor="flatSearch" className="label">Search Flat</label>
                  <input
                    id="flatSearch"
                    className="input"
                    placeholder="A-101"
                    value={flatSearch}
                    onChange={(e) => setFlatSearch(e.target.value)}
                  />
                </div>
                <div className="form-group !mb-0 sm:col-span-2">
                  <label htmlFor="flat" className="label">Select Flat *</label>
                  <select
                    id="flat"
                    className="input"
                    value={form.flatId}
                    onChange={(e) => {
                      const flat = lookup.flats.find((item) => item.id === e.target.value);
                      setForm({ ...form, flatId: e.target.value, unitId: flat?.unitId || "" });
                    }}
                    required
                  >
                    <option value="">Choose your flat</option>
                    {flats.map((flat) => (
                      <option key={flat.id} value={flat.id}>
                        {flat.flatNumber}{flat.ownerName ? ` - ${flat.ownerName}` : ""}
                      </option>
                    ))}
                  </select>
                  {flats.length === 0 && (
                    <p className="text-xs text-danger-text mt-2">
                      No available flats found for this role. Contact your committee.
                    </p>
                  )}
                </div>
              </div>

              {selectedFlat && (
                <div className="p-4 rounded-xl bg-surface border border-border mb-6">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Occupancy Context
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-sm">
                    <div>
                      <p className="text-xs text-text-secondary">Status</p>
                      <p className="font-semibold text-text-primary">{selectedFlat.occupancyStatus.replaceAll("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Primary Occupant</p>
                      <p className="font-semibold text-text-primary">{selectedFlat.primaryOccupant || selectedFlat.ownerName || "Not linked"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Billing</p>
                      <p className="font-semibold text-text-primary">{selectedFlat.billingStatus}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 border-t border-border pt-4 text-sm">
                    <div>
                      <p className="text-xs text-text-secondary">Owner</p>
                      <p className="font-semibold text-text-primary">{selectedFlat.ownerName || "Owner not linked yet"}</p>
                      {(selectedFlat.ownerPhone || selectedFlat.ownerEmail) && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          {[selectedFlat.ownerPhone, selectedFlat.ownerEmail].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Tenant</p>
                      <p className="font-semibold text-text-primary">{selectedFlat.tenantName || "No active tenant"}</p>
                      {selectedFlat.tenantPhone && (
                        <p className="text-xs text-text-secondary mt-0.5">{selectedFlat.tenantPhone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
                Occupancy Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="form-group !mb-0">
                  <label htmlFor="moveInDate" className="label">Move-in Date</label>
                  <input
                    id="moveInDate"
                    type="date"
                    className="input"
                    value={form.moveInDate}
                    onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
                  />
                </div>
                <div className="form-group !mb-0">
                  <label htmlFor="agreementEndDate" className="label">Agreement End Date</label>
                  <input
                    id="agreementEndDate"
                    type="date"
                    className="input"
                    value={form.agreementEndDate}
                    onChange={(e) => setForm({ ...form, agreementEndDate: e.target.value })}
                    disabled={form.relationshipType !== "TENANT"}
                  />
                </div>
                <div className="form-group !mb-0">
                  <label htmlFor="emergencyContact" className="label">Emergency Contact</label>
                  <input
                    id="emergencyContact"
                    {...phoneInputProps}
                    className="input"
                    value={form.emergencyContact}
                    onChange={(e) => setForm({ ...form, emergencyContact: sanitizePhoneInput(e.target.value) })}
                  />
                </div>
                <div className="form-group !mb-0">
                  <label htmlFor="vehicleCount" className="label">Vehicle Count</label>
                  <input
                    id="vehicleCount"
                    type="number"
                    min="0"
                    className="input"
                    value={form.vehicleCount}
                    onChange={(e) => setForm({ ...form, vehicleCount: e.target.value })}
                  />
                </div>
                <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm font-medium text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.isPrimaryOccupant}
                    onChange={(e) => setForm({ ...form, isPrimaryOccupant: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Primary occupant for this unit
                </label>
              </div>

              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
                Account Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="form-group !mb-0">
                  <label htmlFor="name" className="label">Full Name *</label>
                  <input
                    id="name"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group !mb-0">
                  <label htmlFor="phone" className="label">Phone</label>
                  <input
                    id="phone"
                    {...phoneInputProps}
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: sanitizePhoneInput(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group !mb-0">
                  <label htmlFor="email" className="label">Email *</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group !mb-0">
                  <label htmlFor="password" className="label">Password *</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className="input pr-10"
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={joining} className="btn btn-primary w-full btn-lg">
                {joining ? (
                  <div className="spinner !w-5 !h-5 !border-white/30 !border-t-white" />
                ) : (
                  t("Create Account & Join")
                )}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            {/*
            <p className="text-sm text-text-secondary">
              Chairman?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Create a society
              </Link>
            </p>
            */}
            <p className="text-sm text-text-secondary mt-2">
              Already joined?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
