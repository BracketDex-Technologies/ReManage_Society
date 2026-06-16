"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useEffect, useState, useCallback } from "react";
import { Plus, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, Home, X, ClipboardList } from "lucide-react";

interface MoveEvent {
  id: string;
  type: string;
  residentName: string;
  residentType: string;
  status: string;
  workflowStatus?: string;
  checklist: string;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  shiftingChargePaid?: boolean;
  shiftingChargeAmount?: number;
  policeVerificationFileName?: string | null;
  policeVerificationDataUrl?: string | null;
  leaseAgreementFileName?: string | null;
  leaseAgreementDataUrl?: string | null;
  gatePassCode?: string | null;
  flat: { flatNumber: string; wing: string | null; ownerName: string };
}

interface Flat {
  id: string;
  flatNumber: string;
  wing: string | null;
  ownerName: string;
}

export default function MoveEventsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [events, setEvents] = useState<MoveEvent[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MoveEvent | null>(null);
  const [updatingItem, setUpdatingItem] = useState<number | null>(null);

  const [form, setForm] = useState({ flatId: "", type: "move_in", residentName: "", residentType: "owner", notes: "" });

  const fetchEvents = useCallback(() => {
    setLoading(true);
    fetch("/api/move-events")
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => toastT.error("Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEvents();
    fetch("/api/members?flatsOnly=true")
      .then((r) => r.json())
      .then((d) => setFlats(d.flats || d || []))
      .catch(() => {});
  }, [fetchEvents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/move-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toastT.success(`${form.type === "move_in" ? "Move-in" : "Move-out"} process started`);
        setShowForm(false);
        setForm({ flatId: "", type: "move_in", residentName: "", residentType: "owner", notes: "" });
        fetchEvents();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed");
      }
    } catch { toastT.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const toggleChecklistItem = async (eventId: string, index: number) => {
    setUpdatingItem(index);
    try {
      const event = events.find((e) => e.id === eventId);
      if (!event) return;
      const checklist = JSON.parse(event.checklist || "[]");
      const newStatus = checklist[index].status === "completed" ? "pending" : "completed";

      const res = await fetch("/api/move-events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, checklistIndex: index, status: newStatus }),
      });
      if (res.ok) {
        toastT.success(newStatus === "completed" ? "Item completed ✓" : "Item unchecked");
        fetchEvents();
        // Refresh selected event
        const updated = await res.json();
        if (selectedEvent?.id === eventId) {
          setSelectedEvent({ ...selectedEvent, checklist: updated.checklist, status: updated.status });
        }
      }
    } catch { toastT.error("Update failed"); }
    finally { setUpdatingItem(null); }
  };

  const wizardAction = async (eventId: string, action: "approve" | "reject", reason?: string) => {
    try {
      const res = await fetch(`/api/move-wizard/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const result = await res.json();
      if (!res.ok) {
        toastT.error(result.error || "Action failed");
        return;
      }
      toastT.success(result.message || "Updated");
      fetchEvents();
    } catch {
      toastT.error("Something went wrong");
    }
  };

  const pendingWizard = events.filter((e) => e.workflowStatus === "pending_approval");
  const active = events.filter(
    (e) => e.status !== "completed" && e.status !== "cancelled" && e.workflowStatus !== "pending_approval",
  );
  const completed = events.filter((e) => e.status === "completed");

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-500/5 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-500/5">
            <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-none sm:leading-normal">{t("Move In / Move Out")}</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">{t("Checklist-driven handover workflows")}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 flex items-center justify-center">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "ACTIVE", val: active.length, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
          { label: "MOVE-INS", val: events.filter((e) => e.type === "move_in").length, color: "text-emerald-600", bg: "bg-emerald-50", icon: ArrowDownLeft },
          { label: "MOVE-OUTS", val: events.filter((e) => e.type === "move_out").length, color: "text-red-600", bg: "bg-red-50", icon: ArrowUpRight },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 sm:p-6 rounded-2xl border border-border/50">
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}><s.icon className="w-4 h-4 sm:w-5 sm:h-5" /></div>
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-text-tertiary mt-4 tracking-[0.1em] uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending wizard approvals */}
      {pendingWizard.length > 0 && (
        <div className="card border-l-4 border-l-warning mb-6">
          <h2 className="text-sm font-bold text-text-primary mb-3">
            Pending self-serve requests ({pendingWizard.length})
          </h2>
          <div className="space-y-3">
            {pendingWizard.map((event) => (
              <div key={event.id} className="rounded-xl border border-border p-4 bg-surface/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{event.residentName}</p>
                    <p className="text-xs text-text-secondary">
                      {event.type === "move_in" ? "Move in" : "Move out"} · Flat{" "}
                      {event.flat.wing ? `${event.flat.wing}-` : ""}
                      {event.flat.flatNumber} · {event.residentType}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      Shifting: {event.shiftingChargePaid ? "Paid" : "Unpaid"}
                      {event.shiftingChargeAmount
                        ? ` · ₹${event.shiftingChargeAmount.toLocaleString("en-IN")}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {event.policeVerificationDataUrl && (
                        <a
                          href={event.policeVerificationDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                        >
                          Police verification
                        </a>
                      )}
                      {event.leaseAgreementDataUrl && (
                        <a
                          href={event.leaseAgreementDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                        >
                          Lease agreement
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => wizardAction(event.id, "approve")}
                      className="btn btn-primary btn-sm"
                    >
                      Approve & issue gate pass
                    </button>
                    <button
                      type="button"
                      onClick={() => wizardAction(event.id, "reject", "Documents incomplete")}
                      className="btn btn-secondary btn-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Events */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="spinner !w-8 !h-8" /></div>
      ) : (
        <div className="space-y-3">
          {active.length === 0 && completed.length === 0 ? (
            <div className="card text-center py-24 bg-surface/30 border-dashed border-2">
              <ClipboardList className="w-10 h-10 text-text-tertiary mx-auto mb-4 opacity-20" />
              <p className="text-text-primary font-bold">No move events</p>
              <p className="text-xs text-text-secondary mt-1">Create a move-in or move-out workflow</p>
            </div>
          ) : (
            <>
              {active.map((event) => {
                const checklist = JSON.parse(event.checklist || "[]");
                const completedCount = checklist.filter((c: { status: string }) => c.status === "completed").length;
                const progress = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0;
                return (
                  <div key={event.id} className={`bg-white rounded-[1.25rem] border p-5 sm:p-6 transition-all hover:shadow-md ${event.type === "move_in" ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-red-400"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${event.type === "move_in" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                          {event.type === "move_in" ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{event.residentName}</h4>
                          <p className="text-[10px] text-text-secondary">{event.flat.wing ? `${event.flat.wing}-` : ""}{event.flat.flatNumber} · {event.residentType} · {event.type === "move_in" ? "Moving In" : "Moving Out"}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)} className="text-xs font-bold text-primary hover:underline">
                        {selectedEvent?.id === event.id ? "Collapse" : "Checklist"}
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-text-tertiary">{completedCount}/{checklist.length} tasks</span>
                        <span className="text-[10px] font-bold text-primary">{progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {/* Expanded Checklist */}
                    {selectedEvent?.id === event.id && (
                      <div className="mt-4 pt-4 border-t border-border/30 space-y-2 animate-in fade-in duration-200">
                        {checklist.map((item: { item: string; status: string; completedBy?: string }, i: number) => (
                          <button key={i} onClick={() => toggleChecklistItem(event.id, i)} disabled={updatingItem === i} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${item.status === "completed" ? "bg-emerald-50 border border-emerald-200" : "bg-surface/50 border border-border/40 hover:border-primary/20"}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                              {item.status === "completed" && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-xs font-medium flex-1 ${item.status === "completed" ? "text-emerald-700 line-through" : "text-text-primary"}`}>{item.item}</span>
                            {item.completedBy && <span className="text-[9px] text-text-tertiary">{item.completedBy}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {completed.length > 0 && (
                <div className="pt-6">
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-3 px-1">COMPLETED ({completed.length})</p>
                  {completed.map((event) => (
                    <div key={event.id} className="bg-surface/50 rounded-xl p-4 flex items-center justify-between mb-2 opacity-60">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-xs font-semibold text-text-primary">{event.residentName} · {event.flat.flatNumber}</p>
                          <p className="text-[10px] text-text-tertiary">{event.type === "move_in" ? "Moved In" : "Moved Out"} · {event.completedAt ? new Date(event.completedAt).toLocaleDateString("en-IN") : ""}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* New Event Modal */}
      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-md sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-text-primary">New Move Event</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-surface text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 pb-20 sm:pb-0">
              <div className="flex gap-2">
                {["move_in", "move_out"].map((moveType) => (
                  <button key={moveType} type="button" onClick={() => setForm({ ...form, type: moveType })} className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${form.type === moveType ? (moveType === "move_in" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "bg-surface text-text-secondary"}`}>
                    {moveType === "move_in" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    {moveType === "move_in" ? t("Move In") : t("Move Out")}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Select Flat *</label>
                <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full" value={form.flatId} onChange={(e) => setForm({ ...form, flatId: e.target.value })} required>
                  <option value="">Choose flat...</option>
                  {flats.map((f) => <option key={f.id} value={f.id}>{f.wing ? `${f.wing}-` : ""}{f.flatNumber} ({f.ownerName})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Resident Name *</label>
                <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Full name" value={form.residentName} onChange={(e) => setForm({ ...form, residentName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Resident Type</label>
                <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full" value={form.residentType} onChange={(e) => setForm({ ...form, residentType: e.target.value })}>
                  <option value="owner">Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="family">Family Member</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">Notes</label>
                <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder="Special instructions..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">{saving ? "Creating..." : "Start Process"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
