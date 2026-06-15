"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Building2, 
  MessageSquare, 
  FileText, 
  User, 
  Home, 
  AlertCircle,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import toast from "react-hot-toast";

function ComplaintSubmitForm() {
  const searchParams = useSearchParams();
  const sId = searchParams.get("sId");
  
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    societyId: sId || "",
    flatNumber: "",
    raisedBy: "",
    title: "",
    description: "",
    category: "general",
    priority: "medium"
  });

  useEffect(() => {
    if (sId) {
      setForm(prev => ({ ...prev, societyId: sId }));
    }
  }, [sId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.societyId) {
      toast.error("Invalid society link. Please use the original link provided.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/complaints/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
        toast.success("Complaint submitted successfully!");
      } else {
        toast.error(data.error || "Failed to submit complaint");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="card text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-6">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Submitted Successfully!</h2>
        <p className="text-text-secondary mb-8 max-w-sm mx-auto">
          Your complaint has been registered. The society committee has been notified and will look into it soon.
        </p>
        <button 
          onClick={() => {
            setSubmitted(false);
            setForm(prev => ({ ...prev, title: "", description: "" }));
          }}
          className="btn btn-outline"
        >
          Raise Another Complaint
        </button>
      </div>
    );
  }

  if (!sId) {
    return (
      <div className="card text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error/10 mb-4">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Invalid Link</h2>
        <p className="text-text-secondary mb-6">
          This complaint submission link is invalid or incomplete.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden border-none shadow-2xl">
      <div className="bg-primary p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="w-6 h-6" />
          <h2 className="text-xl font-bold">Raise a Complaint</h2>
        </div>
        <p className="text-white/80 text-sm">
          Submit your concerns directly to the society committee.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-surface">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-group">
            <label className="label flex items-center gap-2">
              <Home className="w-4 h-4" /> Flat Number
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. A-101"
              value={form.flatNumber}
              onChange={(e) => setForm({ ...form, flatNumber: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="label flex items-center gap-2">
              <User className="w-4 h-4" /> Your Name
            </label>
            <input
              type="text"
              className="input"
              placeholder="John Doe"
              value={form.raisedBy}
              onChange={(e) => setForm({ ...form, raisedBy: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="label">Complaint Category</label>
          <div className="relative">
            <select
              className="input pr-10 appearance-none"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="general">General</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="security">Security</option>
              <option value="parking">Parking</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          </div>
        </div>

        <div className="form-group">
          <label className="label flex items-center gap-2">
            <FileText className="w-4 h-4" /> Subject
          </label>
          <input
            type="text"
            className="input"
            placeholder="Briefly describe the issue"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="label">Full Description</label>
          <textarea
            className="input min-h-[120px] py-3"
            placeholder="Provide detailed information about your complaint..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="label">Priority Level</label>
          <div className="flex flex-wrap gap-3">
            {["low", "medium", "high", "urgent"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, priority: p })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  form.priority === p 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105"
                    : "bg-surface-variant text-text-secondary hover:bg-surface-variant/80"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full btn-lg mt-4 shadow-xl shadow-primary/20"
        >
          {loading ? (
             <div className="spinner w-5! !h-5 !border-white/30 !border-t-white" />
          ) : (
            "Submit Complaint"
          )}
        </button>
      </form>
    </div>
  );
}

export default function PublicComplaintPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-xl mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Society Connect</h1>
          <p className="text-slate-500 mt-2 font-medium">Resolution through transparency</p>
        </div>
        
        <Suspense fallback={
          <div className="card flex items-center justify-center py-20">
            <div className="spinner !w-10 !h-10 border-primary" />
          </div>
        }>
          <ComplaintSubmitForm />
        </Suspense>

        <p className="mt-8 text-center text-slate-400 text-sm">
          Powered by <span className="font-semibold text-primary">Society Management System</span>
        </p>
      </div>
    </div>
  );
}
