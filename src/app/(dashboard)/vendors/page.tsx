"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Phone,
  FileSignature,
  Mail,
  Plus,
  Settings,
  AlertTriangle,
  Shield,
  Ticket,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  hasAMC: boolean;
  amcAmount: number | null;
  amcStartDate: string | null;
  amcEndDate: string | null;
  insuranceExpiryDate: string | null;
}

function daysUntil(dateIso: string | null) {
  if (!dateIso) return null;
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / 86_400_000);
}

function toneClass(tone: "danger" | "warning" | "success") {
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  return "text-success";
}

function coverageLabel(days: number | null, dateIso: string | null) {
  if (!dateIso || days === null) return null;
  if (days < 0) return { tone: "danger" as const, text: `Expired ${Math.abs(days)} days ago` };
  if (days <= 30) return { tone: "warning" as const, text: `Expires in ${days} days` };
  return { tone: "success" as const, text: "Active" };
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "plumbing",
    phone: "",
    email: "",
    hasAMC: false,
    amcAmount: "",
    amcStartDate: "",
    amcEndDate: "",
    insuranceExpiryDate: "",
  });

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendors");
      const d = await res.json();
      if (d.vendors) setVendors(d.vendors);
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleAdd = async () => {
    if (!form.name) return toast.error("Vendor name is required");

    const load = toast.loading("Saving vendor...");
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Vendor added", { id: load });
        setShowForm(false);
        setForm({
          name: "",
          category: "plumbing",
          phone: "",
          email: "",
          hasAMC: false,
          amcAmount: "",
          amcStartDate: "",
          amcEndDate: "",
          insuranceExpiryDate: "",
        });
        fetchVendors();
      } else {
        toast.error("Failed to add", { id: load });
      }
    } catch {
      toast.error("Error", { id: load });
    }
  };

  const expiringCount = vendors.filter((v) => {
    const amcDays = v.hasAMC ? daysUntil(v.amcEndDate) : null;
    const insuranceDays = daysUntil(v.insuranceExpiryDate);
    return (
      (amcDays !== null && amcDays <= 30) ||
      (insuranceDays !== null && insuranceDays <= 30)
    );
  }).length;

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title">Vendors & AMC</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Manage service providers, AMC renewals, and compliance certificates
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary btn-sm flex items-center gap-2"
        >
          {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Vendor</>}
        </button>
      </div>

      {expiringCount > 0 && (
        <div className="card border-warning/40 bg-warning/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">
                {expiringCount} vendor{expiringCount === 1 ? "" : "s"} need renewal attention
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                High-priority tickets are auto-created 30 days before AMC or insurance expiry and assigned to the Secretary.
              </p>
            </div>
          </div>
          <Link href="/complaints" className="btn btn-secondary btn-sm flex items-center gap-2 w-fit">
            <Ticket className="w-4 h-4" />
            View tickets
          </Link>
        </div>
      )}

      {showForm && (
        <div className="card animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sm mb-4">Add New Service Provider</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Company / Vendor Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Service Category</label>
              <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="lift">Lift Maintenance</option>
                <option value="security">Security Agency</option>
                <option value="cleaning">Housekeeping / Cleaning</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="pest">Pest Control</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Contact Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <label className="flex items-center gap-2 mb-4 bg-surface p-3 rounded-lg border border-border w-fit cursor-pointer">
              <input type="checkbox" checked={form.hasAMC} onChange={(e) => setForm({ ...form, hasAMC: e.target.checked })} />
              <span className="font-medium text-sm">Has Active AMC (Annual Maintenance Contract)</span>
            </label>

            {form.hasAMC && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-primary/5 p-4 rounded-lg border border-primary/20 mb-4">
                <div>
                  <label className="label">Annual Amount (₹)</label>
                  <input type="number" className="input" value={form.amcAmount} onChange={(e) => setForm({ ...form, amcAmount: e.target.value })} />
                </div>
                <div>
                  <label className="label">Starts From</label>
                  <input type="date" className="input" value={form.amcStartDate} onChange={(e) => setForm({ ...form, amcStartDate: e.target.value })} />
                </div>
                <div>
                  <label className="label">Valid Until (Expiry)</label>
                  <input type="date" className="input" value={form.amcEndDate} onChange={(e) => setForm({ ...form, amcEndDate: e.target.value })} />
                </div>
              </div>
            )}

            <div className="bg-surface p-4 rounded-lg border border-border">
              <label className="label flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Insurance / Fire Safety Certificate Expiry
              </label>
              <input
                type="date"
                className="input max-w-xs"
                value={form.insuranceExpiryDate}
                onChange={(e) => setForm({ ...form, insuranceExpiryDate: e.target.value })}
              />
              <p className="text-xs text-text-secondary mt-2">
                Used for fire safety, liability, or statutory compliance renewals (e.g. lift inspection certificate).
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleAdd} className="btn btn-primary">Save Vendor</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : vendors.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-border" />
          <p>No vendors or AMCs added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => {
            const amcDays = v.hasAMC ? daysUntil(v.amcEndDate) : null;
            const insuranceDays = daysUntil(v.insuranceExpiryDate);
            const amcStatus = coverageLabel(amcDays, v.amcEndDate);
            const insuranceStatus = coverageLabel(insuranceDays, v.insuranceExpiryDate);
            const needsAttention =
              (amcDays !== null && amcDays <= 30) ||
              (insuranceDays !== null && insuranceDays <= 30);

            return (
              <div key={v.id} className="card relative overflow-hidden flex flex-col h-full">
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    needsAttention ? "bg-warning" : v.hasAMC || v.insuranceExpiryDate ? "bg-success" : "bg-border"
                  }`}
                />

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">{v.name}</h3>
                    <span className="text-xs uppercase font-medium bg-surface px-2 py-0.5 rounded-md border border-border inline-block mt-1">
                      {v.category}
                    </span>
                  </div>
                  {(v.hasAMC || v.insuranceExpiryDate) && (
                    <span className="bg-primary/10 text-primary p-1.5 rounded-md">
                      <FileSignature className="w-4 h-4" />
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm mb-4 flex-1">
                  {v.phone && (
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Phone className="w-3.5 h-3.5" /> {v.phone}
                    </div>
                  )}
                  {v.email && (
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Mail className="w-3.5 h-3.5" /> {v.email}
                    </div>
                  )}
                </div>

                {(v.hasAMC || v.insuranceExpiryDate) && (
                  <div className="mt-auto pt-4 border-t border-border space-y-3">
                    {v.hasAMC && (
                      <div>
                        <p className="text-xs text-text-secondary mb-1">AMC</p>
                        {v.amcAmount && <p className="font-bold text-sm">{formatCurrency(v.amcAmount)}/yr</p>}
                        {v.amcEndDate && amcStatus && (
                          <p className={`text-xs mt-0.5 font-medium ${toneClass(amcStatus.tone)}`}>
                            {new Date(v.amcEndDate).toLocaleDateString("en-IN")} — {amcStatus.text}
                          </p>
                        )}
                      </div>
                    )}
                    {v.insuranceExpiryDate && insuranceStatus && (
                      <div>
                        <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Insurance / Compliance
                        </p>
                        <p className={`text-xs font-medium ${toneClass(insuranceStatus.tone)}`}>
                          {new Date(v.insuranceExpiryDate).toLocaleDateString("en-IN")} — {insuranceStatus.text}
                        </p>
                      </div>
                    )}
                    {needsAttention && (
                      <p className="text-xs text-warning flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Auto-ticket assigned to Secretary
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
