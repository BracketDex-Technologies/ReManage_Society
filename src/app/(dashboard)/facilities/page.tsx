"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/user-context";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { Plus, CalendarCheck, Clock, Info, User, Home, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import DuesEnforcementBanner from "@/components/ux/DuesEnforcementBanner";
import { useDuesEnforcementStatus } from "@/lib/use-dues-enforcement";
import { canUseResidentSelfService, isCommitteeRole } from "@/lib/roles";

interface Facility {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  ratePerHour: number;
  isActive: boolean;
  rules: string | null;
  bookings: Booking[];
}

interface Booking {
  id: string;
  facilityId: string;
  bookedBy: string;
  flatNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: string;
  amount: number;
  facility?: { name: string };
}



export default function FacilitiesPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"facilities" | "bookings">("facilities");
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useUser();

  const [facilityForm, setFacilityForm] = useState({ name: "", description: "", capacity: "", ratePerHour: "", rules: "" });
  const [bookingForm, setBookingForm] = useState({
    facilityId: "",
    flatNumber: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "11:00",
    purpose: "",
  });

  const isCommittee = isCommitteeRole(user?.role);
  const canBook = canUseResidentSelfService(user?.role);
  const { status: duesStatus, blocked: duesBlocked } = useDuesEnforcementStatus();

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/facilities").then((r) => r.json()),
      fetch("/api/facilities/bookings").then((r) => r.json()),
    ])
      .then(([facData, bookData]) => {
        setFacilities(facData.facilities || []);
        setBookings(bookData.bookings || []);
      })
      .catch(() => toastT.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [toastT]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (user.flatNumber && canBook) {
      setBookingForm((prev) => ({ ...prev, flatNumber: user.flatNumber! }));
    }
  }, [user.flatNumber, canBook]);

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facilityForm),
      });
      if (res.ok) {
        toastT.success("Facility added");
        setShowAddFacility(false);
        setFacilityForm({ name: "", description: "", capacity: "", ratePerHour: "", rules: "" });
        fetchData();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed");
      }
    } catch { toastT.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBook) return;
    setSaving(true);
    try {
      const res = await fetch("/api/facilities/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingForm),
      });
      if (res.ok) {
        toastT.success("Booking confirmed!");
        setShowBooking(false);
        setBookingForm({ ...bookingForm, facilityId: "", purpose: "" });
        fetchData();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed");
      }
    } catch { toastT.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-6 lg:px-0 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <CalendarCheck className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">{t("Facilities")}</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5 font-medium">
              {isCommittee ? t("Manage amenities and review the booking schedule.") : t("Explore and book society amenities")}
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
          {isCommittee && (
            <button onClick={() => setShowAddFacility(true)} className="btn btn-secondary !rounded-xl px-4 sm:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center shrink-0">
              <Plus className="w-4 h-4 mr-2" /> {t("Add Amenity")}
            </button>
          )}
          {canBook && (
          <button onClick={() => setShowBooking(true)} className="btn btn-primary !rounded-xl px-5 sm:px-8 py-2.5 sm:py-3 font-bold text-xs sm:text-sm shadow-md shadow-primary/10 transition-all hover:scale-[1.01] active:scale-[0.98] shrink-0" disabled={facilities.length === 0 || duesBlocked}>
            <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> {t("New Booking")}
          </button>
          )}
        </div>
      </div>

      {canBook && <DuesEnforcementBanner status={duesStatus} />}

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 mb-6 w-fit shadow-sm">
        {(["facilities", "bookings"] as const).map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)} className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${tab === tabKey ? "bg-primary text-white shadow-md shadow-primary/20 scale-105" : "text-text-secondary hover:text-text-primary hover:bg-surface"}`}>
            {tabKey === "facilities" ? t("Marketplace") : t("Current Schedule")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : tab === "facilities" ? (
        facilities.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarCheck className="w-8 h-8 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{t("No Facilities Found")}</h3>
            <p className="text-text-secondary mt-1">{t("The society board hasn't added any facilities yet.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {facilities.map((f) => (
              <div key={f.id} className="card group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">{f.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${f.ratePerHour > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {f.ratePerHour > 0 ? t("{rate}/hr").replace("{rate}", formatCurrency(f.ratePerHour)) : t("Free to Use")}
                      </span>
                      {f.capacity && <span className="bg-surface px-2 py-0.5 rounded-full text-[10px] text-text-secondary font-medium">{t("Capacity: {capacity}").replace("{capacity}", String(f.capacity))}</span>}
                    </div>
                  </div>
                </div>
                {f.description && <p className="text-sm text-text-secondary mb-4 line-clamp-2">{f.description}</p>}
                
                {f.rules && (
                  <div className="bg-surface rounded-lg p-3 mb-4 flex gap-2 items-start">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary italic">{f.rules}</p>
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                   <div className="flex -space-x-2">
                      {f.bookings.slice(0, 3).map((b, i) => (
                        <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-surface flex items-center justify-center text-[10px] font-bold text-text-secondary" title={t("Booked by {flatNumber}").replace("{flatNumber}", b.flatNumber)}>
                          {b.flatNumber.charAt(0)}
                        </div>
                      ))}
                      {f.bookings.length > 3 && <div className="w-7 h-7 rounded-full border-2 border-white bg-surface flex items-center justify-center text-[10px] font-bold text-text-secondary">+{f.bookings.length - 3}</div>}
                   </div>
                   {canBook && (
                   <button onClick={() => { setBookingForm({ ...bookingForm, facilityId: f.id }); setShowBooking(true); }} className="btn btn-primary btn-sm px-4" disabled={duesBlocked}>
                    {t("Book Now")}
                  </button>
                   )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        bookings.length === 0 ? (
          <div className="card text-center py-16 text-text-secondary">{t("No active bookings for your society.")}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookings.map((b) => (
                <div key={b.id} className="card card-hover flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-xl bg-surface flex flex-col items-center justify-center border border-border">
                    <span className="text-[10px] font-bold text-primary uppercase">{new Date(b.date).toLocaleDateString("en-IN", { month: "short" })}</span>
                    <span className="text-sm font-bold text-text-primary">{new Date(b.date).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-text-primary truncate">{b.facility?.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b.startTime} - {b.endTime}</span>
                      <span className="flex items-center gap-1 font-semibold text-primary"><Home className="w-3 h-3" /> {b.flatNumber}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-text-primary">{formatCurrency(b.amount)}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${b.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {isCommittee && (
              <div className="card bg-surface mt-6 border-transparent">
                <div className="flex items-center gap-2 mb-4 text-text-primary font-bold">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h4>{t("Management Ledger")}</h4>
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("Facility")}</th>
                        <th>{t("Date")}</th>
                        <th>{t("Time")}</th>
                        <th>{t("Occupant")}</th>
                        <th>{t("Amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id}>
                          <td className="font-medium text-text-primary">{b.facility?.name}</td>
                          <td>{new Date(b.date).toLocaleDateString()}</td>
                          <td>{b.startTime}–{b.endTime}</td>
                          <td>
                            <div className="text-sm font-bold">{b.flatNumber}</div>
                            <div className="text-xs text-text-secondary">{b.bookedBy}</div>
                          </td>
                          <td className="font-bold text-primary">{formatCurrency(b.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Add Facility Modal */}
      {showAddFacility && (
        <div className="modal-overlay" onClick={() => setShowAddFacility(false)}>
          <div className="modal-content !max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-text-primary">{t("New Society Facility")}</h3>
              <button onClick={() => setShowAddFacility(false)} className="text-text-secondary hover:text-text-primary">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddFacility} className="space-y-4">
              <div><label className="label">{t("Name *")}</label><input className="input" placeholder={t("e.g. Clubhouse, Terrace Garden")} value={facilityForm.name} onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })} required /></div>
              <div><label className="label">{t("Description")}</label><input className="input" placeholder={t("e.g. Modern swimming pool with life guard")} value={facilityForm.description} onChange={(e) => setFacilityForm({ ...facilityForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">{t("Capacity")}</label><input type="number" className="input" placeholder="50" value={facilityForm.capacity} onChange={(e) => setFacilityForm({ ...facilityForm, capacity: e.target.value })} /></div>
                <div><label className="label">{t("Hourly Rate (₹)")}</label><input type="number" className="input" placeholder={t("0 if free")} value={facilityForm.ratePerHour} onChange={(e) => setFacilityForm({ ...facilityForm, ratePerHour: e.target.value })} /></div>
              </div>
              <div><label className="label">{t("Usage Rules")}</label><textarea className="input !h-auto" rows={3} placeholder={t("e.g. No food allowed inside gym")} value={facilityForm.rules} onChange={(e) => setFacilityForm({ ...facilityForm, rules: e.target.value })} /></div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddFacility(false)} className="btn btn-secondary flex-1">{t("Cancel")}</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? t("Adding...") : t("Add Facility")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Facility Modal */}
      {showBooking && canBook && (
        <div className="modal-overlay" onClick={() => setShowBooking(false)}>
          <div className="modal-content !max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-text-primary">{t("Reserve Amenity")}</h3>
              <button onClick={() => setShowBooking(false)} className="text-text-secondary hover:text-text-primary">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="label">{t("Which facility? *")}</label>
                <select className="select" value={bookingForm.facilityId} onChange={(e) => setBookingForm({ ...bookingForm, facilityId: e.target.value })} required>
                  <option value="">{t("Choose one...")}</option>
                  {facilities.filter((f) => f.isActive).map((f) => (
                    <option key={f.id} value={f.id}>{f.name} {f.ratePerHour > 0 ? t("({rate}/hr)").replace("{rate}", formatCurrency(f.ratePerHour)) : t("(Free)")}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">{t("Flat Number *")}</label><input className="input" placeholder={t("e.g. C-402")} value={bookingForm.flatNumber} onChange={(e) => setBookingForm({ ...bookingForm, flatNumber: e.target.value })} required disabled={!!user?.flatNumber} /></div>
                <div><label className="label">{t("Booking Date *")}</label><input type="date" className="input" value={bookingForm.date} onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })} required min={new Date().toISOString().split("T")[0]} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">{t("From *")}</label><input type="time" className="input" value={bookingForm.startTime} onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })} required /></div>
                <div><label className="label">{t("Until *")}</label><input type="time" className="input" value={bookingForm.endTime} onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })} required /></div>
              </div>
              <div><label className="label">{t("Purpose / Context")}</label><input className="input" placeholder={t("e.g. Birthday Party")} value={bookingForm.purpose} onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })} /></div>
              
              <div className="bg-primary/5 rounded-xl p-4 flex gap-3">
                 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                 </div>
                 <div className="text-xs text-text-secondary">
                    <p className="font-semibold text-text-primary">{t("Confirming for {name}").replace("{name}", user?.name || t("Member"))}</p>
                    <p className="mt-0.5">{t("Payment will be added to your next maintenance bill if applicable.")}</p>
                 </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBooking(false)} className="btn btn-secondary flex-1">{t("Dismiss")}</button>
                <button type="submit" disabled={saving || duesBlocked} className="btn btn-primary flex-1">{saving ? t("Confirming...") : t("Book Now")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
