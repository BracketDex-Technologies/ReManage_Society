"use client";

import { useEffect, useState } from "react";
import { PiggyBank, Plus, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_GROUPS, FUND_CATEGORIES, defaultExpenseCategoryForFund } from "@/lib/finance-categories";

interface FundTx { id: string; type: string; amount: number; description: string; balanceAfter: number; createdAt: string; }
interface Fund { id: string; name: string; type: string; balance: number; description: string | null; transactions: FundTx[]; }

export default function FundsPage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [txForm, setTxForm] = useState<{ fundId: string; type: string; amount: string; description: string; category: string } | null>(null);
  const [form, setForm] = useState({ name: "", type: "sinking", description: "", initialBalance: "" });

  const load = async () => { setLoading(true); try { const r = await fetch("/api/funds"); const d = await r.json(); if (Array.isArray(d)) setFunds(d); } catch { toast.error("Failed"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name) return toast.error("Fund name required");
    const t = toast.loading("Creating..."); try {
      const r = await fetch("/api/funds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) { toast.success("Created!", { id: t }); setShowForm(false); setForm({ name: "", type: "sinking", description: "", initialBalance: "" }); load(); }
      else toast.error("Failed", { id: t });
    } catch { toast.error("Error", { id: t }); }
  };

  const handleTx = async () => {
    if (!txForm?.amount || !txForm?.description) return toast.error("Fill all fields");
    const t = toast.loading("Processing..."); try {
      const r = await fetch(`/api/funds/${txForm.fundId}/transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txForm) });
      if (r.ok) { toast.success(txForm.type === "debit" ? "Debit recorded and expense created" : "Credit recorded", { id: t }); setTxForm(null); load(); } else {
        const data = await r.json();
        toast.error(data.error || "Failed", { id: t });
      }
    } catch { toast.error("Error", { id: t }); }
  };

  const total = funds.reduce((s, f) => s + f.balance, 0);

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div className="flex items-center gap-3">
          <PiggyBank className="w-6 h-6 text-primary" />
          <div><h1 className="page-title">Fund Accounts</h1><p className="text-sm text-text-secondary mt-0.5">Sinking fund, corpus, reserve accounts</p></div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm flex items-center gap-2">{showForm ? "Cancel" : <><Plus className="w-4 h-4" /> New Fund</>}</button>
      </div>

      <div className="card bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-3"><Wallet className="w-8 h-8 text-primary" /><div><p className="text-xs text-text-secondary uppercase tracking-wider">Total Balance</p><p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p></div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm font-bold text-text-primary">Fund Accounts</p>
          <p className="text-xs text-text-secondary mt-1">Where money is kept, like sinking fund, reserve fund, corpus fund, or maintenance fund.</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-text-primary">Debit From Fund</p>
          <p className="text-xs text-text-secondary mt-1">When money is spent from a fund, it also creates an Expense automatically.</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-text-primary">Budget Link</p>
          <p className="text-xs text-text-secondary mt-1">That expense updates Budget Planning under the selected expense category.</p>
        </div>
      </div>

      {showForm && (
        <div className="card animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sm mb-4">Create New Fund</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Fund Name *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Type</label><select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{FUND_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div><label className="label">Opening Balance (₹)</label><input type="number" className="input" value={form.initialBalance} onChange={e => setForm({ ...form, initialBalance: e.target.value })} /></div>
            <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button onClick={handleCreate} className="btn btn-primary">Create</button></div>
        </div>
      )}

      {txForm && (
        <div className="card animate-in fade-in zoom-in-95 duration-200 border-2 border-primary/30">
          <h3 className="font-semibold text-sm mb-4">Record {txForm.type === "credit" ? "Credit" : "Debit"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Amount (₹) *</label><input type="number" className="input" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} /></div>
            <div><label className="label">Description *</label><input className="input" value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} /></div>
            {txForm.type === "debit" && (
              <div>
                <label className="label">Expense Category *</label>
                <select className="select" value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value })}>
                  {EXPENSE_CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.categories.map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-xs text-text-secondary mt-1">This decides which budget line gets utilized.</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2"><button onClick={() => setTxForm(null)} className="btn btn-secondary">Cancel</button><button onClick={handleTx} className={`btn ${txForm.type === "credit" ? "btn-primary" : "bg-danger text-white hover:bg-danger/90"}`}>{txForm.type === "credit" ? "Add Credit" : "Record Debit"}</button></div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : funds.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary"><PiggyBank className="w-12 h-12 mx-auto mb-3 text-border" /><p>No fund accounts yet.</p></div>
      ) : (
        <div className="space-y-4">{funds.map(f => (
          <div key={f.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div><h3 className="font-semibold text-lg">{f.name}</h3><span className="text-xs uppercase font-medium bg-surface px-2 py-0.5 rounded-md border border-border">{f.type}</span>{f.description && <p className="text-sm text-text-secondary mt-1">{f.description}</p>}</div>
              <p className="text-xl font-bold text-primary">{formatCurrency(f.balance)}</p>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setTxForm({ fundId: f.id, type: "credit", amount: "", description: "", category: "other" })} className="btn btn-sm bg-success/10 text-success hover:bg-success/20 flex items-center gap-1"><ArrowDownLeft className="w-3.5 h-3.5" /> Credit</button>
              <button onClick={() => setTxForm({ fundId: f.id, type: "debit", amount: "", description: "", category: defaultExpenseCategoryForFund(f.type) })} className="btn btn-sm bg-danger/10 text-danger hover:bg-danger/20 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> Debit</button>
            </div>
            {f.transactions.length > 0 && (
              <div className="border-t border-border pt-3"><p className="text-xs text-text-secondary mb-2 font-medium">Recent Transactions</p>
                <div className="space-y-1.5">{f.transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center text-sm py-1.5 px-2 rounded bg-surface/50">
                    <div className="flex items-center gap-2">{tx.type === "credit" ? <ArrowDownLeft className="w-3.5 h-3.5 text-success" /> : <ArrowUpRight className="w-3.5 h-3.5 text-danger" />}<span>{tx.description}</span></div>
                    <span className={`font-medium ${tx.type === "credit" ? "text-success" : "text-danger"}`}>{tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}</span>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        ))}</div>
      )}
    </div>
  );
}
