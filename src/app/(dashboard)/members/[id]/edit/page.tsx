"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.member) {
          setForm({
            flatNumber: data.member.flatNumber || "",
            wing: data.member.wing || "",
            floor: data.member.floor?.toString() || "",
            ownerName: data.member.ownerName || "",
            tenantName: data.member.tenantName || "",
            contact: data.member.contact || "",
            email: data.member.email || "",
            vehicleNumber: data.member.vehicleNumber || "",
          });
        }
        setFetching(false);
      })
      .catch(() => {
        toast.error("Failed to load member");
        setFetching(false);
      });
  }, [id]);

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
      const res = await fetch(`/api/members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Flat ${form.flatNumber} updated successfully`);
        router.push("/members");
      } else {
        toast.error(data.error || "Failed to update member");
      }
    } catch {
      toast.error("Something went wrong — please try again");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: "" });
  };

  if (fetching) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="p-2 rounded-lg hover:bg-surface transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="page-title">Edit Member</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Update flat {form.flatNumber} details
          </p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group mb-0!">
              <label className="label">Flat Number *</label>
              <input className={`input ${errors.flatNumber ? "!border-danger" : ""}`} value={form.flatNumber} onChange={(e) => updateField("flatNumber", e.target.value)} />
              {errors.flatNumber && <p className="form-error">{errors.flatNumber}</p>}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Wing</label>
              <input className="input" value={form.wing} onChange={(e) => updateField("wing", e.target.value)} />
            </div>
            <div className="form-group mb-0!">
              <label className="label">Floor</label>
              <input type="number" className="input" value={form.floor} onChange={(e) => updateField("floor", e.target.value)} />
            </div>
            <div className="form-group mb-0!">
              <label className="label">Owner Name *</label>
              <input className={`input ${errors.ownerName ? "!border-danger" : ""}`} value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} />
              {errors.ownerName && <p className="form-error">{errors.ownerName}</p>}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Tenant Name</label>
              <input className="input" value={form.tenantName} onChange={(e) => updateField("tenantName", e.target.value)} />
            </div>
            <div className="form-group mb-0!">
              <label className="label">Contact Number *</label>
              <input type="tel" className={`input ${errors.contact ? "!border-danger" : ""}`} value={form.contact} onChange={(e) => updateField("contact", e.target.value)} maxLength={10} />
              {errors.contact && <p className="form-error">{errors.contact}</p>}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Email Address</label>
              <input type="email" className={`input ${errors.email ? "!border-danger" : ""}`} value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div className="form-group mb-0!">
              <label className="label">Vehicle Number</label>
              <input className="input" value={form.vehicleNumber} onChange={(e) => updateField("vehicleNumber", e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : "Update Member"}
            </button>
            <Link href="/members" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
