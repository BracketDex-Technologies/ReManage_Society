"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AddMemberPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    flatNumber: "",
    wing: "",
    floor: "",
    ownerName: "",
    tenantName: "",
    contact: "",
    email: "",
    vehicleNumber: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.flatNumber) errs.flatNumber = "Flat number is required";
    if (!form.ownerName || form.ownerName.length < 2)
      errs.ownerName = "Owner name must be at least 2 characters";
    if (!form.contact || !/^\d{10}$/.test(form.contact))
      errs.contact = "Enter a valid 10-digit mobile number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email address";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Flat ${form.flatNumber} added successfully`);
        router.push("/members");
      } else {
        toast.error(data.error || "Failed to add member");
      }
    } catch {
      toast.error("Something went wrong — please try again");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/members"
          className="p-2 rounded-lg hover:bg-surface transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="page-title">Add New Member</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Add a flat and its owner details
          </p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group mb-0!">
              <label className="label">Flat Number *</label>
              <input
                className={`input ${errors.flatNumber ? "!border-danger" : ""}`}
                placeholder="e.g. A-101"
                value={form.flatNumber}
                onChange={(e) => updateField("flatNumber", e.target.value)}
              />
              {errors.flatNumber && (
                <p className="form-error">{errors.flatNumber}</p>
              )}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Wing</label>
              <input
                className="input"
                placeholder="e.g. A, B, C"
                value={form.wing}
                onChange={(e) => updateField("wing", e.target.value)}
              />
            </div>
            <div className="form-group mb-0!">
              <label className="label">Floor</label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 1, 2, 3"
                value={form.floor}
                onChange={(e) => updateField("floor", e.target.value)}
              />
            </div>
            <div className="form-group mb-0!">
              <label className="label">Owner Name *</label>
              <input
                className={`input ${errors.ownerName ? "!border-danger" : ""}`}
                placeholder="Full name"
                value={form.ownerName}
                onChange={(e) => updateField("ownerName", e.target.value)}
              />
              {errors.ownerName && (
                <p className="form-error">{errors.ownerName}</p>
              )}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Tenant Name</label>
              <input
                className="input"
                placeholder="Optional"
                value={form.tenantName}
                onChange={(e) => updateField("tenantName", e.target.value)}
              />
            </div>
            <div className="form-group mb-0!">
              <label className="label">Contact Number *</label>
              <input
                type="tel"
                className={`input ${errors.contact ? "!border-danger" : ""}`}
                placeholder="10-digit mobile"
                value={form.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                maxLength={10}
              />
              {errors.contact && (
                <p className="form-error">{errors.contact}</p>
              )}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Email Address</label>
              <input
                type="email"
                className={`input ${errors.email ? "!border-danger" : ""}`}
                placeholder="Optional"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Vehicle Number</label>
              <input
                className="input"
                placeholder="e.g. MH12AB1234"
                value={form.vehicleNumber}
                onChange={(e) => updateField("vehicleNumber", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" />
              ) : (
                "Save Member"
              )}
            </button>
            <Link href="/members" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
