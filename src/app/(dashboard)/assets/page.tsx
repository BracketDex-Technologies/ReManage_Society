"use client";

import { useEffect, useState } from "react";
import { HardDrive, Plus, Wrench, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface Asset { id: string; name: string; category: string; location: string | null; purchaseDate: string | null; purchaseAmount: number | null; currentValue: number | null; warrantyEnd: string | null; vendor: string | null; serialNumber: string | null; condition: string; lastMaintenanceAt: string | null; nextMaintenanceAt: string | null; maintenanceCycle: number | null; notes: string | null; isActive: boolean; }
const CATS = ["generator", "elevator", "pump", "gym_equipment", "cctv", "furniture", "other"];
const CONDS = [{ v: "excellent", l: "Excellent", c: "text-success" }, { v: "good", l: "Good", c: "text-primary" }, { v: "fair", l: "Fair", c: "text-warning" }, { v: "poor", l: "Poor", c: "text-danger" }, { v: "out_of_order", l: "Out of Order", c: "text-danger" }];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "generator", location: "", purchaseDate: "", purchaseAmount: "", currentValue: "", warrantyEnd: "", vendor: "", serialNumber: "", condition: "good", maintenanceCycle: "", notes: "" });

  const load = async () => { setLoading(true); try { const r = await fetch("/api/assets"); const d = await r.json(); if (Array.isArray(d)) setAssets(d); } catch { toast.error("Failed"); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name) return toast.error("Name required");
    const t = toast.loading("Saving..."); try {
      const r = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) { toast.success("Added!", { id: t }); setShowForm(false); setForm({ name: "", category: "generator", location: "", purchaseDate: "", purchaseAmount: "", currentValue: "", warrantyEnd: "", vendor: "", serialNumber: "", condition: "good", maintenanceCycle: "", notes: "" }); load(); }
      else toast.error("Failed", { id: t });
    } catch { toast.error("Error", { id: t }); }
  };

  const needsMaint = assets.filter(a => a.nextMaintenanceAt && new Date(a.nextMaintenanceAt) <= new Date());
  const totalValue = assets.reduce((s, a) => s + (a.currentValue || a.purchaseAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div className="flex items-center gap-3"><HardDrive className="w-6 h-6 text-primary" /><div><h1 className="page-title">Asset Register</h1><p className="text-sm text-text-secondary mt-0.5">Track society equipment and maintenance schedules</p></div></div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm flex items-center gap-2">{showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Asset</>}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><p className="text-xs text-text-secondary">Total Assets</p><p className="text-xl font-bold">{assets.length}</p></div>
        <div className="card"><p className="text-xs text-text-secondary">Total Value</p><p className="text-xl font-bold text-primary">{formatCurrency(totalValue)}</p></div>
        <div className="card"><p className="text-xs text-text-secondary">Due for Maintenance</p><p className={`text-xl font-bold ${needsMaint.length > 0 ? "text-danger" : "text-success"}`}>{needsMaint.length}</p></div>
      </div>

      {needsMaint.length > 0 && (
        <div className="card border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-warning" /><span className="font-semibold text-sm text-warning">Maintenance Overdue</span></div>
          <div className="space-y-1">{needsMaint.map(a => <p key={a.id} className="text-sm">{a.name} — due {a.nextMaintenanceAt ? new Date(a.nextMaintenanceAt).toLocaleDateString("en-IN") : ""}</p>)}</div>
        </div>
      )}

      {showForm && (
        <div className="card animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sm mb-4">Add New Asset</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Category *</label><select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATS.map(c => <option key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}</select></div>
            <div><label className="label">Location</label><input className="input" placeholder="Basement, Lobby..." value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label">Purchase Date</label><input type="date" className="input" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} /></div>
            <div><label className="label">Purchase Amount (₹)</label><input type="number" className="input" value={form.purchaseAmount} onChange={e => setForm({ ...form, purchaseAmount: e.target.value })} /></div>
            <div><label className="label">Current Value (₹)</label><input type="number" className="input" value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })} /></div>
            <div><label className="label">Warranty End</label><input type="date" className="input" value={form.warrantyEnd} onChange={e => setForm({ ...form, warrantyEnd: e.target.value })} /></div>
            <div><label className="label">Vendor</label><input className="input" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
            <div><label className="label">Serial No.</label><input className="input" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} /></div>
            <div><label className="label">Condition</label><select className="select" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>{CONDS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}</select></div>
            <div><label className="label">Maintenance Cycle (days)</label><input type="number" className="input" value={form.maintenanceCycle} onChange={e => setForm({ ...form, maintenanceCycle: e.target.value })} /></div>
            <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button><button onClick={handleAdd} className="btn btn-primary">Save Asset</button></div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="spinner" /></div> : assets.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary"><Wrench className="w-12 h-12 mx-auto mb-3 text-border" /><p>No assets registered yet.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{assets.map(a => {
          const cond = CONDS.find(c => c.v === a.condition);
          return (
            <div key={a.id} className="card">
              <div className="flex justify-between items-start mb-3"><div><h3 className="font-semibold">{a.name}</h3><span className="text-xs uppercase bg-surface px-2 py-0.5 rounded-md border border-border">{a.category.replace("_", " ")}</span></div><span className={`text-xs font-semibold ${cond?.c || ""}`}>{cond?.l}</span></div>
              {a.location && <p className="text-sm text-text-secondary mb-1">📍 {a.location}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary mt-2">
                {a.purchaseAmount && <div>Purchase: {formatCurrency(a.purchaseAmount)}</div>}
                {a.currentValue && <div>Current: {formatCurrency(a.currentValue)}</div>}
                {a.warrantyEnd && <div className={new Date(a.warrantyEnd) < new Date() ? "text-danger" : ""}>Warranty: {new Date(a.warrantyEnd).toLocaleDateString("en-IN")}</div>}
                {a.vendor && <div>Vendor: {a.vendor}</div>}
              </div>
            </div>
          );
        })}</div>
      )}
    </div>
  );
}
