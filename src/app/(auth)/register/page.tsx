"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Building2, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    societyName: "",
    societyAddress: "",
    city: "",
    pincode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Account created! Redirecting...");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch {
      toast.error("Something went wrong — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Create Society
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Chairman onboarding for a new society
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Chairman Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="form-group !mb-0">
                <label htmlFor="name" className="label">Full Name *</label>
                <input id="name" className="input" placeholder="Your full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group !mb-0">
                <label htmlFor="phone" className="label">Phone</label>
                <input id="phone" type="tel" className="input" placeholder="10-digit mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group !mb-0">
                <label htmlFor="reg-email" className="label">Email *</label>
                <input id="reg-email" type="email" className="input" placeholder="you@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group !mb-0">
                <label htmlFor="reg-password" className="label">Password *</label>
                <div className="relative">
                  <input id="reg-password" type={showPassword ? "text" : "password"} className="input pr-10" placeholder="Min 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Society Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="form-group !mb-0 sm:col-span-2">
                <label htmlFor="societyName" className="label">Society Name *</label>
                <input id="societyName" className="input" placeholder="Your society name" value={form.societyName} onChange={(e) => setForm({ ...form, societyName: e.target.value })} required />
              </div>
              <div className="form-group !mb-0 sm:col-span-2">
                <label htmlFor="societyAddress" className="label">Address *</label>
                <input id="societyAddress" className="input" placeholder="Full society address" value={form.societyAddress} onChange={(e) => setForm({ ...form, societyAddress: e.target.value })} required />
              </div>
              <div className="form-group !mb-0">
                <label htmlFor="city" className="label">City *</label>
                <input id="city" className="input" placeholder="Pune" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              </div>
              <div className="form-group !mb-0">
                <label htmlFor="pincode" className="label">Pincode *</label>
                <input id="pincode" className="input" placeholder="411001" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
              {loading ? <div className="spinner !w-5 !h-5 !border-white/30 !border-t-white" /> : "Create Society"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-text-secondary">
              Resident or tenant?{" "}
              <Link href="/join" className="text-primary font-medium hover:underline">Join your society</Link>
            </p>
            <p className="text-sm text-text-secondary mt-2">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
