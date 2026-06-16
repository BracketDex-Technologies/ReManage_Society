"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Car, Trash2, Share2, User, Home, ShieldAlert, X, Bike, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useAppDialog } from "@/components/ui/AppDialogProvider";
import { ModuleEmptyState, ModulePageHeader, ModuleStatCard } from "@/components/ux/ModulePageKit";

interface ParkingSlot {
  id: string;
  slotNumber: string;
  slotType: string;
  level?: string | null;
  wing: string | null;
  isAssigned: boolean;
  vehicleNo: string | null;
  flat?: { flatNumber: string; ownerName: string } | null;
  currentAssignment?: {
    unitOccupancy?: { person?: { name: string }, unit?: { flatNumber: string } };
    vehicle?: { registrationNumber: string } | null;
  } | null;
}

interface AssignableOccupancy {
  occupancyId: string;
  flatNumber: string;
  wing: string | null;
  name: string;
  phone: string | null;
  relationshipType: string;
  ownerName: string | null;
  tenantName: string | null;
  occupancyStatus: string;
  label: string;
}

const typeIcons: Record<string, LucideIcon> = {
  car: Car,
  CAR: Car,
  bike: Bike,
  BIKE: Bike,
  ev: Zap,
  EV: Zap,
  VISITOR: Home,
  STAFF: ShieldAlert,
};

const getSlotIcon = (slotType: string) => typeIcons[slotType] || Car;

export default function ParkingPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const router = useRouter();
  const { confirm } = useAppDialog();
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [assignableOccupancies, setAssignableOccupancies] = useState<AssignableOccupancy[]>([]);
  const [nextSlotNumber, setNextSlotNumber] = useState("P-001");
  const [stats, setStats] = useState({ total: 0, assigned: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState<ParkingSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ slotNumber: "", slotType: "CAR", wing: "", level: "", occupancyId: "", vehicleNo: "" });
  const [assignForm, setAssignForm] = useState({ occupancyId: "", vehicleNo: "" });
  const { user } = useUser();

  const isAdmin = user?.role === "chairman" || user?.role === "secretary" || user?.role === "treasurer";
  const requiresResidentAssignment = ["CAR", "BIKE", "EV"].includes(form.slotType);
  const selectedFormOccupancy = assignableOccupancies.find((item) => item.occupancyId === form.occupancyId);
  const selectedAssignOccupancy = assignableOccupancies.find((item) => item.occupancyId === assignForm.occupancyId);

  const fetchSlots = useCallback(() => {
    setLoading(true);
    fetch("/api/parking")
      .then((r) => r.json())
      .then((d) => {
        setSlots(d.slots || []);
        setAssignableOccupancies(d.assignableOccupancies || []);
        setNextSlotNumber(d.nextSlotNumber || "P-001");
        setStats(d.stats || { total: 0, assigned: 0, available: 0 });
      })
      .catch(() => toastT.error("Failed to load parking data"))
      .finally(() => setLoading(false));
  }, [toastT]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresResidentAssignment && !form.occupancyId) {
      toastT.error("Select an active resident/tenant for this resident parking slot");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slotNumber: form.slotNumber || nextSlotNumber }),
      });
      if (res.ok) {
        toastT.success("Slot created successfully");
        setShowForm(false);
        setForm({ slotNumber: "", slotType: "CAR", wing: "", level: "", occupancyId: "", vehicleNo: "" });
        fetchSlots();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed to create slot");
      }
    } catch { toastT.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleAssign = async () => {
    if (!showAssign) return;
    try {
      const res = await fetch(`/api/parking/${showAssign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...assignForm, isAssigned: true }),
      });
      if (res.ok) {
        toastT.success("Parking slot assigned");
        fetchSlots();
      }
    } catch { toastT.error("Failed to assign slot"); }
    setShowAssign(null);
  };

  const handleUnassign = async (id: string) => {
    const ok = await confirm({
      title: t("Free Parking Slot"),
      message: t("Free this slot and remove the current assignment?"),
      confirmLabel: t("Free Slot"),
      danger: true,
    });
    if (!ok) return;
    try {
      await fetch(`/api/parking/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAssigned: false }),
      });
      toastT.success("Slot is now available");
      fetchSlots();
    } catch { toastT.error("Failed to unassign slot"); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t("Delete Parking Slot"),
      message: t("Delete this physical parking slot from records?"),
      confirmLabel: t("Delete Slot"),
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/parking/${id}`, { method: "DELETE" });
    toastT.success("Slot deleted");
    fetchSlots();
  };

  // Filter for members
  const mySlots = slots.filter(s => s.flat?.flatNumber === user?.flatNumber || s.currentAssignment?.unitOccupancy?.unit?.flatNumber === user?.flatNumber);

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={Car}
        title={t("Parking Registry")}
        description={isAdmin ? t("Oversee society allocations, availability, and vehicle links.") : t("Review your parking space and exchange options.")}
        meta={`${stats.available} ${t("free")}`}
        tone="blue"
        actions={
          <>
          <button onClick={() => router.push("/parking/marketplace")} className="btn btn-secondary !rounded-xl px-4 sm:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center shrink-0">
            <Share2 className="w-4 h-4 mr-2" /> <span>{t("Exchange")}</span>
          </button>
          {isAdmin && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.98] shrink-0">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> <span>{t("Add New Slot")}</span>
            </button>
          )}
          </>
        }
      />

      {/* Stats Board */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <ModuleStatCard icon={Home} label={t("Total")} value={stats.total} tone="primary" />
        <ModuleStatCard icon={User} label={t("Occupied")} value={stats.assigned} tone="blue" />
        <ModuleStatCard icon={ShieldAlert} label={t("Available")} value={stats.available} tone="emerald" />
      </div>

      {/* Member's Personal Section */}
      {!isAdmin && user?.flatNumber && (
        <div className="bg-gradient-to-br from-indigo-50/50 to-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-indigo-100/50 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 sm:w-1.5 sm:h-6 bg-primary rounded-full" />
              <h2 className="text-base sm:text-lg font-bold text-text-primary tracking-tight">{t("My Allocations")}</h2>
           </div>
           
           {mySlots.length === 0 ? (
             <div className="text-center py-10 sm:py-16 bg-white/50 rounded-2xl border border-dashed border-border/60">
                <p className="text-xs sm:text-sm text-text-secondary font-medium">{t("No assigned parking slots at the moment.")}</p>
                <p className="text-[10px] sm:text-xs text-text-tertiary mt-1">{t("Visit management to register your vehicle.")}</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
               {mySlots.map(slot => (
                 <div key={slot.id} className="bg-white rounded-2xl border border-primary/20 shadow-xl shadow-primary/5 overflow-hidden transition-transform hover:scale-[1.02]">
                    <div className="bg-primary text-white p-4 flex justify-between items-center">
                       <span className="font-bold tracking-wider uppercase text-[10px] opacity-80">{slot.slotType} {t("slot")}</span>
                       <span className="text-lg font-bold">{slot.slotNumber}</span>
                    </div>
                    <div className="p-5 sm:p-6">
                       <div className="flex justify-between items-center mb-4">
                          {(() => {
                            const SlotIcon = getSlotIcon(slot.slotType);
                            return (
                              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                                <SlotIcon className="size-6" />
                              </div>
                            );
                          })()}
                          <div className="text-right">
                             <p className="text-[9px] font-bold text-text-tertiary uppercase mb-0.5">{t("Vehicle")}</p>
                             <p className="text-xs sm:text-sm font-bold text-text-primary uppercase">{slot.vehicleNo || slot.currentAssignment?.vehicle?.registrationNumber || t("N/A")}</p>
                          </div>
                       </div>
                       <button onClick={() => router.push("/parking/marketplace")} className="w-full btn btn-secondary !rounded-xl py-2 sm:py-2.5 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-2">
                          <Share2 className="w-4 h-4" /> {t("Share My Space")}
                       </button>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}

      {/* Main Grid View */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base sm:text-lg font-bold text-text-primary tracking-tight">
             {isAdmin ? t("Global Inventory") : t("Occupancy Map")}
          </h3>
          <div className="flex gap-2">
             <div className="flex items-center gap-2 text-[9px] font-bold text-text-tertiary uppercase bg-white border border-border/50 px-2.5 py-1 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t("Free")}
             </div>
             <div className="flex items-center gap-2 text-[9px] font-bold text-text-tertiary uppercase bg-white border border-border/50 px-2.5 py-1 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {t("Full")}
             </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="spinner !w-8 !h-8" />
            <p className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">{t("Grid syncing...")}</p>
          </div>
        ) : slots.length === 0 ? (
          <ModuleEmptyState icon={Car} title={t("No slots recorded yet")} description={t("Create parking slots to begin managing assignments.")} tone="blue" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {slots.map((slot) => {
              const isMine = slot.flat?.flatNumber === user?.flatNumber;
              return (
                <div
                  key={slot.id}
                  className={`bg-white rounded-xl border p-3.5 sm:p-4 transition-all duration-300 relative group overflow-hidden ${
                    slot.isAssigned 
                      ? isMine 
                        ? "border-primary bg-primary/5 shadow-md scale-105 z-10" 
                        : "border-border/40 opacity-70" 
                      : "border-emerald-200 bg-emerald-50/20 hover:border-emerald-400 hover:shadow-sm"
                  }`}
                >
                  <div className="absolute top-1.5 right-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
                     {(() => {
                       const SlotIcon = getSlotIcon(slot.slotType);
                       return <SlotIcon className="size-4" />;
                     })()}
                  </div>
                  
                  <p className="text-base font-bold text-text-primary leading-none uppercase">{slot.slotNumber}</p>
                  {slot.wing && <p className="text-[8px] font-bold text-text-tertiary uppercase mt-1">{slot.wing} {t("Wing")}</p>}
                  
                  {slot.isAssigned ? (
                    <div className="mt-4 pt-3 border-t border-border/30">
                      <p className="text-[10px] font-bold text-text-primary leading-tight">
                        {t("Flat")} {slot.flat?.flatNumber || slot.currentAssignment?.unitOccupancy?.unit?.flatNumber || "???"}
                      </p>
                      {slot.currentAssignment?.unitOccupancy?.person?.name && (
                        <p className="text-[9px] text-text-secondary mt-1 truncate">{slot.currentAssignment.unitOccupancy.person.name}</p>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleUnassign(slot.id)} className="mt-2.5 w-full py-1 text-[8px] font-bold uppercase text-danger hover:underline">
                          {t("Retract")}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-emerald-100">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase mb-3">{t("Available")}</p>
                      {isAdmin && (
                        <div className="flex gap-1.5">
                          <button onClick={() => { setShowAssign(slot); setAssignForm({ occupancyId: "", vehicleNo: "" }); }} className="flex-1 py-1 bg-primary text-white text-[9px] font-bold rounded-lg uppercase transition-transform active:scale-95 shadow-sm">{t("Assign")}</button>
                          <button onClick={() => handleDelete(slot.id)} className="p-1 px-1.5 text-danger hover:bg-danger/5 rounded-lg border border-transparent hover:border-danger/20"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  )}
                  {isMine && (
                    <div className="absolute top-0 left-0 bg-primary text-white text-[8px] px-2 py-0.5 rounded-br-lg font-bold shadow-sm uppercase">{t("My Box")}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Slot Modal - Mobile Optimized */}
      {showForm && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-lg sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                     <Plus className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-xl font-bold text-text-primary tracking-tight">{t("Expand Registry")}</h3>
                     <p className="text-xs font-medium text-text-secondary mt-0.5">{t("Define physical parking units")}</p>
                  </div>
               </div>
               <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-surface text-text-tertiary transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Slot Name *")}</label>
                 <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder={nextSlotNumber} value={form.slotNumber || nextSlotNumber} onChange={(e) => setForm({ ...form, slotNumber: e.target.value.toUpperCase() })} required />
                 <p className="text-[10px] text-text-secondary ml-1">{t("Suggested automatically from existing active slots. You can still edit it.")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Type")}</label>
                  <select className="select !rounded-xl !bg-surface font-bold py-3.5 px-4" value={form.slotType} onChange={(e) => setForm({ ...form, slotType: e.target.value })}>
                    <option value="CAR">{t("4-Wheeler")}</option>
                    <option value="BIKE">{t("2-Wheeler")}</option>
                    <option value="EV">{t("EV Point")}</option>
                    <option value="VISITOR">{t("Visitor")}</option>
                    <option value="STAFF">{t("Staff")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Location / Wing")}</label>
                   <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder={t("A, LG-1...")} value={form.wing} onChange={(e) => setForm({ ...form, wing: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Level / Zone")}</label>
                   <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" placeholder={t("Basement 1, Podium, Open...")} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/40 p-4 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">
                    {requiresResidentAssignment ? t("Assign To Active Resident *") : t("Assign To Active Resident (optional)")}
                  </label>
                  <select
                    className="select !rounded-xl !bg-white font-bold text-sm px-4 py-3.5 mt-2"
                    value={form.occupancyId}
                    onChange={(e) => setForm({ ...form, occupancyId: e.target.value })}
                    required={requiresResidentAssignment}
                  >
                    <option value="">{requiresResidentAssignment ? t("Choose active linked flat") : t("Keep unassigned")}</option>
                    {assignableOccupancies.map((item) => (
                      <option key={item.occupancyId} value={item.occupancyId}>{item.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-secondary mt-2">
                    {t("Only active owner/co-owner/tenant occupancies are shown here. Vacant or unlinked flats cannot receive resident parking.")}
                  </p>
                </div>

                {selectedFormOccupancy && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-border bg-white p-3">
                    <div>
                      <p className="text-[9px] font-bold text-text-tertiary uppercase">{t("Flat")}</p>
                      <p className="text-xs font-black text-text-primary">{selectedFormOccupancy.flatNumber}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-text-tertiary uppercase">{t("Occupant")}</p>
                      <p className="text-xs font-black text-text-primary">{selectedFormOccupancy.name}</p>
                      <p className="text-[10px] text-text-secondary">{selectedFormOccupancy.relationshipType.replaceAll("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-text-tertiary uppercase">{t("Owner")}</p>
                      <p className="text-xs font-black text-text-primary">{selectedFormOccupancy.ownerName || t("Not linked")}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Vehicle Number")}</label>
                  <input
                    className="input !rounded-xl !bg-white font-bold text-sm px-4 py-3.5 uppercase tracking-wide font-mono mt-2"
                    placeholder="MH-XX-XX-0000"
                    value={form.vehicleNo}
                    onChange={(e) => setForm({ ...form, vehicleNo: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">{t("Cancel")}</button>
                <button type="submit" disabled={saving || (requiresResidentAssignment && !form.occupancyId)} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">
                   {saving ? t("Creating...") : t("Confirm Unit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal - Mobile Optimized */}
      {showAssign && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowAssign(null)}>
          <div className="bg-white w-full max-w-lg sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-10 shadow-2xl animate-in slide-in-from-bottom-6 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-10">
               <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <User className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-text-primary tracking-tight">{t("Assign Slot")} {showAssign.slotNumber}</h3>
                  <p className="text-xs font-medium text-text-secondary mt-0.5">{t("Link a member and their vehicle")}</p>
               </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Active Resident / Occupancy *")}</label>
                 <select className="select !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5" value={assignForm.occupancyId} onChange={(e) => setAssignForm({ ...assignForm, occupancyId: e.target.value })}>
                   <option value="">{t("Choose active flat owner / tenant")}</option>
                   {assignableOccupancies.map((item) => (
                     <option key={item.occupancyId} value={item.occupancyId}>{item.label}</option>
                   ))}
                 </select>
                 {assignableOccupancies.length === 0 && (
                   <p className="text-xs text-danger-text mt-2">{t("Create/link residents first. Parking can only be assigned to active occupancies.")}</p>
                 )}
              </div>
              {selectedAssignOccupancy && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-border bg-surface/50 p-3">
                  <div>
                    <p className="text-[9px] font-bold text-text-tertiary uppercase">{t("Flat")}</p>
                    <p className="text-xs font-black text-text-primary">{selectedAssignOccupancy.flatNumber}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-text-tertiary uppercase">{t("Occupant")}</p>
                    <p className="text-xs font-black text-text-primary">{selectedAssignOccupancy.name}</p>
                    <p className="text-[10px] text-text-secondary">{selectedAssignOccupancy.relationshipType.replaceAll("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-text-tertiary uppercase">{t("Owner")}</p>
                    <p className="text-xs font-black text-text-primary">{selectedAssignOccupancy.ownerName || t("Not linked")}</p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("Vehicle Details")}</label>
                 <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 uppercase tracking-wide font-mono" placeholder="MH-XX-XX-0000" value={assignForm.vehicleNo} onChange={(e) => setAssignForm({ ...assignForm, vehicleNo: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-6">
                <button onClick={() => setShowAssign(null)} className="flex-1 btn btn-secondary !rounded-xl py-4 font-bold text-sm">{t("Back")}</button>
                <button onClick={handleAssign} disabled={!assignForm.occupancyId} className="flex-[2] btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20">{t("Finalize Link")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
