"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Plus, BarChart3, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_GROUPS, expenseCategoryLabel } from "@/lib/finance-categories";

interface Budget {
  id: string;
  fiscalYear: string;
  category: string;
  planned: number;
  actual: number;
  actualFromExpenses?: number;
  actualFromFundDebits?: number;
  notes: string | null;
}

function currentFiscalYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ fiscalYear: "2026-27", category: "maintenance", planned: "", notes: "" });

  const load = async () => { setLoading(true); try { const r = await fetch("/api/budgets"); const d = await r.json(); if (Array.isArray(d)) setBudgets(d); } catch { toast.error("Failed"); } finally { setLoading(false); } };
  useEffect(() => {
    const fiscalYear = currentFiscalYear();
    setSelectedYear(fiscalYear);
    setForm((current) => ({ ...current, fiscalYear }));
    load();
  }, []);

  const handleSave = async () => {
    if (!form.planned) return toast.error("Planned amount required");
    const t = toast.loading("Saving..."); try {
      const r = await fetch("/api/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) { toast.success("Saved!", { id: t }); setShowForm(false); setEditingId(null); load(); } else toast.error("Failed", { id: t });
    } catch { toast.error("Error", { id: t }); }
  };

  const years = [...new Set([currentFiscalYear(), ...budgets.map(b => b.fiscalYear)])];
  const [selectedYear, setSelectedYear] = useState("2026-27");
  const filtered = budgets.filter(b => b.fiscalYear === selectedYear);
  const totalPlanned = filtered.reduce((s, b) => s + b.planned, 0);
  const totalActual = filtered.reduce((s, b) => s + b.actual, 0);

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div className="flex items-center gap-3"><TrendingUp className="w-6 h-6 text-primary" /><div><h1 className="page-title">Budget Planning</h1><p className="text-sm text-text-secondary mt-0.5">Annual budget vs actual spending</p></div></div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm({ fiscalYear: selectedYear, category: "maintenance", planned: "", notes: "" });
            setShowForm(!showForm);
          }}
          className="btn btn-primary btn-sm flex items-center gap-2"
        >
          {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Set Budget</>}
        </button>
      </div>

      <div className="card bg-primary/5 border-primary/20">
        <p className="text-sm font-semibold text-text-primary">How Total Spent is calculated</p>
        <p className="text-xs text-text-secondary mt-1">
          Total Spent is the sum of real Expenses, paid Staff Payroll, and Fund Account debits for this fiscal year. The expense category decides which budget line gets utilized.
        </p>
      </div>

      {years.length > 0 && (
        <div className="flex gap-2">{years.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${selectedYear === y ? "bg-primary text-white" : "bg-surface border border-border"}`}>{y}</button>
        ))}</div>
      )}

      <p className="text-xs text-text-secondary">
        Showing budget and spending for fiscal year <span className="font-bold text-text-primary">{selectedYear}</span>
        {" "}({selectedYear.slice(0, 4)} Apr to {Number(selectedYear.slice(0, 4)) + 1} Mar).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><p className="text-xs text-text-secondary">Total Planned</p><p className="text-xl font-bold">{formatCurrency(totalPlanned)}</p></div>
        <div className="card"><p className="text-xs text-text-secondary">Total Spent</p><p className="text-xl font-bold text-danger">{formatCurrency(totalActual)}</p></div>
        <div className="card"><p className="text-xs text-text-secondary">Variance</p><p className={`text-xl font-bold ${totalPlanned - totalActual >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(totalPlanned - totalActual)}</p></div>
      </div>

      {showForm && (
        <div className="card animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sm mb-4">{editingId ? "Edit Budget Line" : "Set Budget Line"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Fiscal Year</label><select className="select" value={form.fiscalYear} onChange={e => setForm({ ...form, fiscalYear: e.target.value })}><option>2024-25</option><option>2025-26</option><option>2026-27</option></select></div>
            <div>
              <label className="label">Category</label>
              <select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {EXPENSE_CATEGORY_GROUPS.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.categories.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div><label className="label">Planned Amount (₹) *</label><input type="number" className="input" value={form.planned} onChange={e => setForm({ ...form, planned: e.target.value })} /></div>
            <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn btn-secondary">Cancel</button><button onClick={handleSave} className="btn btn-primary">Save</button></div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : filtered.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary"><BarChart3 className="w-12 h-12 mx-auto mb-3 text-border" /><p>No budgets set for {selectedYear}.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-text-secondary"><th className="pb-3 font-medium">Category</th><th className="pb-3 font-medium text-right">Planned</th><th className="pb-3 font-medium text-right">Actual</th><th className="pb-3 font-medium text-right">Variance</th><th className="pb-3 font-medium text-right">Utilization</th><th className="pb-3 font-medium text-right">Action</th></tr></thead>
            <tbody>{filtered.map(b => { const v = b.planned - b.actual; const pct = b.planned > 0 ? Math.round((b.actual / b.planned) * 100) : 0; return (
              <tr key={b.id} className="border-b border-border/50 last:border-0">
                <td className="py-3">
                  <p className="font-medium capitalize">{expenseCategoryLabel(b.category)}</p>
                  {b.notes ? (
                    <p className="text-[10px] text-text-secondary mt-0.5">{b.notes}</p>
                  ) : b.planned === 0 && b.actual > 0 ? (
                    <p className="text-[10px] text-warning mt-0.5">Spending exists but budget is not planned yet</p>
                  ) : null}
                </td>
                <td className="py-3 text-right">{formatCurrency(b.planned)}</td>
                <td className="py-3 text-right">
                  <p>{formatCurrency(b.actual)}</p>
                  <p className="text-[10px] text-text-secondary">
                    Expenses {formatCurrency(b.actualFromExpenses || 0)}
                    {(b.actualFromFundDebits || 0) > 0 ? ` + Fund debits ${formatCurrency(b.actualFromFundDebits || 0)}` : ""}
                  </p>
                </td>
                <td className={`py-3 text-right font-medium ${v >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(v)}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center gap-2 justify-end"><div className="w-16 h-2 bg-surface rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct > 100 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div><span className="text-xs">{pct}%</span></div>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingId(b.id);
                      setForm({ fiscalYear: b.fiscalYear, category: b.category, planned: String(b.planned), notes: b.notes || "" });
                      setShowForm(true);
                    }}
                    className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                </td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
