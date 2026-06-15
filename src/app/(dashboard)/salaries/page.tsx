"use client";

import { useEffect, useState } from "react";
import { HandCoins, Plus, Check } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface Salary { id: string; staffName: string; staffRole: string; month: string; basicPay: number; overtime: number; deductions: number; bonus: number; netPay: number; paidOn: string | null; paidVia: string | null; status: string; notes: string | null; }
const ROLES = ["security", "housekeeping", "manager", "gardener", "electrician", "plumber", "admin_staff", "other"];

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState<Salary | null>(null);
  const [payForm, setPayForm] = useState({ paidVia: "cash", paidOn: new Date().toISOString().split("T")[0] });
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [form, setForm] = useState({ staffName: "", staffRole: "security", month: curMonth, basicPay: "", overtime: "0", deductions: "0", bonus: "0", notes: "" });

  const load = async () => { setLoading(true); try { const r = await fetch("/api/salaries"); const d = await r.json(); if (Array.isArray(d)) setSalaries(d); } catch { toast.error("Failed"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.staffName || !form.basicPay) return toast.error("Name and basic pay required");
    const t = toast.loading("Saving..."); try {
      const r = await fetch("/api/salaries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) { toast.success("Saved!", { id: t }); setShowForm(false); setForm({ ...form, staffName: "", basicPay: "", overtime: "0", deductions: "0", bonus: "0", notes: "" }); load(); }
      else toast.error("Failed", { id: t });
    } catch { toast.error("Error", { id: t }); }
  };

  const handleMarkPaid = async () => {
    if (!paying) return;
    try {
      const r = await fetch(`/api/salaries/${paying.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payForm),
      });
      const data = await r.json();
      if (r.ok) {
        toast.success("Marked as paid and added to expenses");
        setPaying(null);
        load();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Failed"); }
  };

  const months = [...new Set(salaries.map(s => s.month))].sort().reverse();
  const [selMonth, setSelMonth] = useState(curMonth);
  const filtered = salaries.filter(s => s.month === selMonth);
  const totalNet = filtered.reduce((s, sal) => s + sal.netPay, 0);
  const pending = filtered.filter(s => s.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div className="flex items-center gap-3"><HandCoins className="w-6 h-6 text-primary" /><div><h1 className="page-title">Staff Payroll</h1><p className="text-sm text-text-secondary mt-0.5">Salary management for guards, housekeeping, and staff</p></div></div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm flex items-center gap-2">{showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Salary</>}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><p className="text-xs text-text-secondary">Total Payroll ({selMonth})</p><p className="text-xl font-bold">{formatCurrency(totalNet)}</p></div>
        <div className="card"><p className="text-xs text-text-secondary">Staff Count</p><p className="text-xl font-bold">{filtered.length}</p></div>
        <div className="card"><p className="text-xs text-text-secondary">Pending</p><p className={`text-xl font-bold ${pending > 0 ? "text-warning" : "text-success"}`}>{pending}</p></div>
      </div>

      {months.length > 0 && (
        <div className="flex gap-2 flex-wrap">{months.map(m => (
          <button key={m} onClick={() => setSelMonth(m)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${selMonth === m ? "bg-primary text-white" : "bg-surface border border-border"}`}>{m}</button>
        ))}</div>
      )}

      {showForm && (
        <div className="card animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sm mb-4">Add Salary Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="label">Staff Name *</label><input className="input" value={form.staffName} onChange={e => setForm({ ...form, staffName: e.target.value })} /></div>
            <div><label className="label">Role</label><select className="select" value={form.staffRole} onChange={e => setForm({ ...form, staffRole: e.target.value })}>{ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
            <div><label className="label">Month</label><input type="month" className="input" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
            <div><label className="label">Basic Pay (₹) *</label><input type="number" className="input" value={form.basicPay} onChange={e => setForm({ ...form, basicPay: e.target.value })} /></div>
            <div><label className="label">Overtime (₹)</label><input type="number" className="input" value={form.overtime} onChange={e => setForm({ ...form, overtime: e.target.value })} /></div>
            <div><label className="label">Deductions (₹)</label><input type="number" className="input" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} /></div>
            <div><label className="label">Bonus (₹)</label><input type="number" className="input" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} /></div>
            <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button onClick={handleAdd} className="btn btn-primary">Save</button></div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : filtered.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary"><HandCoins className="w-12 h-12 mx-auto mb-3 text-border" /><p>No salary entries for {selMonth}.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-text-secondary"><th className="pb-3 font-medium">Staff</th><th className="pb-3 font-medium">Role</th><th className="pb-3 font-medium text-right">Basic</th><th className="pb-3 font-medium text-right">OT</th><th className="pb-3 font-medium text-right">Ded.</th><th className="pb-3 font-medium text-right">Net Pay</th><th className="pb-3 font-medium text-center">Status</th><th className="pb-3 font-medium text-center">Action</th></tr></thead>
            <tbody>{filtered.map(s => (
              <tr key={s.id} className="border-b border-border/50 last:border-0">
                <td className="py-3 font-medium">{s.staffName}</td>
                <td className="py-3 capitalize">{s.staffRole}</td>
                <td className="py-3 text-right">{formatCurrency(s.basicPay)}</td>
                <td className="py-3 text-right">{s.overtime > 0 ? formatCurrency(s.overtime) : "-"}</td>
                <td className="py-3 text-right">{s.deductions > 0 ? formatCurrency(s.deductions) : "-"}</td>
                <td className="py-3 text-right font-bold">{formatCurrency(s.netPay)}</td>
                <td className="py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{s.status}</span></td>
                <td className="py-3 text-center">{s.status === "pending" && <button onClick={() => setPaying(s)} className="btn btn-sm bg-success/10 text-success hover:bg-success/20"><Check className="w-3.5 h-3.5" /></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {paying && (
        <div className="modal-overlay" onClick={() => setPaying(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Mark Salary Paid</h3>
            <p className="text-sm text-text-secondary mb-5">
              {paying.staffName} · {formatCurrency(paying.netPay)}
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Paid Via</label>
                <select className="select" value={payForm.paidVia} onChange={(e) => setPayForm({ ...payForm, paidVia: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="neft">NEFT / Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">Paid On</label>
                <input type="date" className="input" value={payForm.paidOn} onChange={(e) => setPayForm({ ...payForm, paidOn: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-8">
              <button onClick={() => setPaying(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleMarkPaid} className="btn btn-primary flex-[2]">Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
