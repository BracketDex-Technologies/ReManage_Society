"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/user-context";
import {
  Building2, Plus, Calendar, Clock, Users, X, Trash2,
  MapPin, IndianRupee, CheckCircle, ChevronLeft, ChevronRight,
  Dumbbell, Waves, Trees, PartyPopper, ClipboardList, Home, Trophy, Car,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAppDialog } from "@/components/ui/AppDialogProvider";
import DuesEnforcementBanner from "@/components/ux/DuesEnforcementBanner";
import { useDuesEnforcementStatus } from "@/lib/use-dues-enforcement";
import { ModuleEmptyState, ModulePageHeader } from "@/components/ux/ModulePageKit";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";

interface Facility {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  ratePerHour: number;
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
  facility?: { name: string; capacity: number | null; ratePerHour: number };
}

const facilityIcons: Record<string, LucideIcon> = {
  gym: Dumbbell,
  pool: Waves,
  hall: Building2,
  garden: Trees,
  "club house": Home,
  "party hall": PartyPopper,
  "meeting room": ClipboardList,
  terrace: Building2,
  court: Trophy,
  parking: Car,
};

const getIcon = (name: string) => {
  const key = Object.keys(facilityIcons).find((k) => name.toLowerCase().includes(k));
  return key ? facilityIcons[key] : Building2;
};

const timeSlots = [
  "06:00","07:00","08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00",
];

export default function AmenitiesPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const { confirm } = useAppDialog();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"facilities" | "my-bookings">("facilities");

  const [bookingForm, setBookingForm] = useState({
    startTime: "09:00",
    endTime: "11:00",
    purpose: "",
  });

  const [facilityForm, setFacilityForm] = useState({
    name: "",
    description: "",
    capacity: "",
    ratePerHour: "0",
    rules: "",
  });

  const isAdmin = ["chairman", "secretary", "treasurer"].includes(user?.role || "");
  const { status: duesStatus, blocked: duesBlocked } = useDuesEnforcementStatus();

  const formatTime = (time: string) => {
    const h = parseInt(time.split(":")[0]);
    return h < 12 ? `${h} ${t("AM")}` : h === 12 ? t("12 PM") : `${h - 12} ${t("PM")}`;
  };

  const fetchFacilities = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/facilities?date=${selectedDate}`).then((r) => r.json()),
      fetch(`/api/facilities/bookings?my=true`).then((r) => r.json()),
    ])
      .then(([facData, bookData]) => {
        setFacilities(facData.facilities || facData || []);
        setMyBookings(bookData.bookings || bookData || []);
      })
      .catch(() => toastT.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [selectedDate, toastT]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const openBooking = (facility: Facility) => {
    setSelectedFacility(facility);
    const firstAvailable = timeSlots.find((slot) => !isSlotBooked(facility, slot)) || "09:00";
    const nextSlot = timeSlots.find((slot) => slot > firstAvailable && !doesRangeOverlapBooking(facility, firstAvailable, slot)) || "11:00";
    setBookingForm({ startTime: firstAvailable, endTime: nextSlot, purpose: "" });
    setShowBookingModal(true);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacility) return;
    if (bookingForm.startTime >= bookingForm.endTime) {
      toastT.error("End time must be after start time");
      return;
    }
    if (doesRangeOverlapBooking(selectedFacility, bookingForm.startTime, bookingForm.endTime)) {
      toastT.error("This time range overlaps an existing booking");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/facilities/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: selectedFacility.id,
          flatNumber: user?.flatNumber || "",
          date: selectedDate,
          startTime: bookingForm.startTime,
          endTime: bookingForm.endTime,
          purpose: bookingForm.purpose,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Booking confirmed");
        setShowBookingModal(false);
        fetchFacilities();
      } else {
        toastT.error(data.error || "Booking failed");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityForm.name) {
      toastT.error("Facility name required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facilityForm),
      });
      if (res.ok) {
        toastT.success("Facility added!");
        setShowAddFacility(false);
        setFacilityForm({ name: "", description: "", capacity: "", ratePerHour: "0", rules: "" });
        fetchFacilities();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed");
      }
    } catch {
      toastT.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    const ok = await confirm({
      title: t("Cancel Booking"),
      message: t("Cancel this amenity booking? The slot will become available for others."),
      confirmLabel: t("Cancel Booking"),
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/facilities/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      if (res.ok) {
        toastT.success("Booking cancelled");
        fetchFacilities();
      }
    } catch {
      toastT.error("Failed");
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const isSlotBooked = (facility: Facility, time: string) => {
    return facility.bookings?.some((b) => b.startTime <= time && b.endTime > time && b.status === "confirmed");
  };

  const getSlotBooking = (facility: Facility, time: string) => {
    return facility.bookings?.find((b) => b.startTime <= time && b.endTime > time && b.status === "confirmed");
  };

  const getBookedRanges = (facility: Facility) => {
    return (facility.bookings || [])
      .filter((b) => b.status === "confirmed")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const doesRangeOverlapBooking = (facility: Facility, startTime: string, endTime: string) => {
    return getBookedRanges(facility).some((booking) => startTime < booking.endTime && endTime > booking.startTime);
  };

  const selectedRangeBlocked = selectedFacility
    ? doesRangeOverlapBooking(selectedFacility, bookingForm.startTime, bookingForm.endTime)
    : false;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={Building2}
        title={t("Amenity Booking")}
        description={t("Reserve shared spaces, review availability, and manage facility slots.")}
        meta={`${facilities.length} ${t("amenities")}`}
        tone="primary"
        actions={isAdmin && (
          <button onClick={() => setShowAddFacility(true)} className="btn btn-primary !rounded-xl px-5 py-2.5 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-primary/10">
            <Plus className="w-4 h-4" /> {t("Add Amenity")}
          </button>
        )}
      />

      <DuesEnforcementBanner status={duesStatus} />

      {/* Tabs */}
      <div className="flex gap-2">
        {(["facilities", "my-bookings"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? "bg-primary text-white shadow-sm" : "bg-surface text-text-secondary hover:bg-primary/5"}`}>
            {tab === "facilities" ? t("All Amenities") : t("My Bookings")}
          </button>
        ))}
      </div>

      {activeTab === "facilities" && (
        <>
          {/* Date Navigator */}
          <div className="flex items-center justify-center gap-4 bg-white rounded-2xl border border-border/50 p-3">
            <button onClick={() => changeDate(-1)} className="p-2 rounded-xl hover:bg-surface transition-colors">
              <ChevronLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div className="text-center">
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-bold text-text-primary text-center cursor-pointer" />
              <p className="text-[10px] text-text-tertiary font-medium mt-0.5">
                {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </p>
            </div>
            <button onClick={() => changeDate(1)} className="p-2 rounded-xl hover:bg-surface transition-colors">
              <ChevronRight className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Facility Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="spinner !w-8 !h-8" /></div>
          ) : facilities.length === 0 ? (
            <ModuleEmptyState
              icon={Building2}
              title={t("No amenities configured")}
              description={isAdmin ? t("Add the first amenity to open reservations.") : t("Amenity reservations will appear after setup.")}
              tone="primary"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {facilities.map((f) => {
                const FacilityIcon = getIcon(f.name);
                return (
                <div key={f.id} className="bg-white rounded-2xl border border-border/50 overflow-hidden hover:shadow-sm transition-all group">
                  {/* Card Header */}
                  <div className="p-5 border-b border-border/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/5 text-primary">
                          <FacilityIcon className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-text-primary">{f.name}</h3>
                          {f.description && <p className="text-xs text-text-secondary mt-0.5">{f.description}</p>}
                        </div>
                      </div>
                      <button onClick={() => openBooking(f)} className="btn btn-primary !rounded-xl !py-2 !px-4 text-xs font-bold opacity-80 group-hover:opacity-100 transition-opacity" disabled={duesBlocked && !isAdmin}>
                        {t("Book")}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      {f.capacity && (
                        <span className="text-[10px] font-bold text-text-tertiary flex items-center gap-1">
                          <Users className="w-3 h-3" /> {f.capacity} {t("capacity")}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-text-tertiary flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" /> {f.ratePerHour > 0 ? `₹${f.ratePerHour}/hr` : t("Free")}
                      </span>
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {f.bookings?.filter((b) => b.status === "confirmed").length || 0} {t("booked today")}
                      </span>
                    </div>
                  </div>

                  {/* Time Slots Grid */}
                  <div className="p-4">
                    <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider mb-2">{t("Availability")}</p>
                    {getBookedRanges(f).length > 0 && (
                      <div className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-red-600">{t("Booked slots")}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getBookedRanges(f).map((booking) => (
                            <span key={booking.id} className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 ring-1 ring-red-100">
                              {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {timeSlots.map((slot) => {
                        const booked = isSlotBooked(f, slot);
                        const booking = getSlotBooking(f, slot);
                        return (
                          <div
                            key={slot}
                            title={booked && booking ? `${t("Booked by Flat")} ${booking.flatNumber}` : t("Available")}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-default ${
                              booked
                                ? "bg-red-500/10 text-red-600"
                                : "bg-green-500/10 text-green-700"
                            }`}
                          >
                            {booked ? t("Booked") : formatTime(slot)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* My Bookings Tab */}
      {activeTab === "my-bookings" && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <ModuleEmptyState icon={Calendar} title={t("No bookings yet")} description={t("Book an amenity to see your reservations here.")} tone="primary" />
          ) : (
            myBookings.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-border/50 p-4 sm:p-5 flex items-center justify-between gap-4 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 sm:gap-4">
                  {(() => {
                    const BookingIcon = getIcon(b.facility?.name || "");
                    return (
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                        <BookingIcon className="size-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">{b.facility?.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-text-tertiary flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(b.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTime(b.startTime)} — {formatTime(b.endTime)}
                      </span>
                      {b.amount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600">₹{b.amount}</span>
                      )}
                    </div>
                    {b.purpose && <p className="text-[10px] text-text-tertiary mt-1">{b.purpose}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.status === "confirmed" && new Date(b.date) >= new Date(new Date().toDateString()) ? (
                    <>
                      <span className="text-[9px] font-bold text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {t("Confirmed")}
                      </span>
                      <button onClick={() => cancelBooking(b.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors" title={t("Cancel")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[9px] font-bold text-text-tertiary">{b.status === "cancelled" ? t("Cancelled") : t("Completed")}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedFacility && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {(() => {
                  const SelectedFacilityIcon = getIcon(selectedFacility.name);
                  return (
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
                      <SelectedFacilityIcon className="size-6" />
                    </div>
                  );
                })()}
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{t("Book")} {selectedFacility.name}</h2>
                  <p className="text-xs text-text-secondary">
                    {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="p-2 rounded-lg hover:bg-surface"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleBook} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Start Time")}</label>
                  <select className="input !rounded-xl text-sm font-semibold" value={bookingForm.startTime} onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}>
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot} disabled={isSlotBooked(selectedFacility, slot)}>
                        {formatTime(slot)} {isSlotBooked(selectedFacility, slot) ? t("(Booked)") : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("End Time")}</label>
                  <select className="input !rounded-xl text-sm font-semibold" value={bookingForm.endTime} onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}>
                    {timeSlots.filter((slot) => slot > bookingForm.startTime).map((slot) => (
                      <option key={slot} value={slot} disabled={doesRangeOverlapBooking(selectedFacility, bookingForm.startTime, slot)}>
                        {formatTime(slot)} {doesRangeOverlapBooking(selectedFacility, bookingForm.startTime, slot) ? t("(Crosses booked slot)") : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {getBookedRanges(selectedFacility).length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-600">{t("Unavailable today")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getBookedRanges(selectedFacility).map((booking) => (
                      <span key={booking.id} className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 ring-1 ring-red-100">
                        {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedRangeBlocked && (
                <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {t("This time range overlaps an existing booking. Please choose another available slot.")}
                </p>
              )}
              <div>
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Purpose (optional)")}</label>
                <input className="input !rounded-xl text-sm font-semibold" value={bookingForm.purpose} onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })} placeholder={t("Birthday party, workout session...")} />
              </div>
              {selectedFacility.ratePerHour > 0 && (
                <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 font-medium flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 shrink-0" />
                  {t("Estimated cost:")} ₹{selectedFacility.ratePerHour * Math.max(parseInt(bookingForm.endTime) - parseInt(bookingForm.startTime), 1)}
                </div>
              )}
              {selectedFacility.rules && (
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 font-medium">
                  📋 {selectedFacility.rules}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowBookingModal(false)} className="btn btn-secondary !rounded-xl !py-2.5 !px-6 text-xs font-bold">{t("Cancel")}</button>
                <button type="submit" disabled={saving || selectedRangeBlocked || (duesBlocked && !isAdmin)} className="btn btn-primary !rounded-xl !py-2.5 !px-6 text-xs font-bold flex items-center gap-2">
                  {saving ? <div className="spinner !w-4 !h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {saving ? t("Booking...") : t("Confirm Booking")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Facility Modal */}
      {showAddFacility && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">{t("Add Amenity")}</h2>
              <button onClick={() => setShowAddFacility(false)} className="p-2 rounded-lg hover:bg-surface"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddFacility} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Name *")}</label>
                <input className="input !rounded-xl text-sm font-semibold" required value={facilityForm.name} onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })} placeholder={t("Gym, Swimming Pool, Party Hall...")} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Description")}</label>
                <input className="input !rounded-xl text-sm font-semibold" value={facilityForm.description} onChange={(e) => setFacilityForm({ ...facilityForm, description: e.target.value })} placeholder={t("Fully equipped with cardio machines...")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Capacity")}</label>
                  <input type="number" className="input !rounded-xl text-sm font-semibold" value={facilityForm.capacity} onChange={(e) => setFacilityForm({ ...facilityForm, capacity: e.target.value })} placeholder="20" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Rate/Hour (₹)")}</label>
                  <input type="number" className="input !rounded-xl text-sm font-semibold" value={facilityForm.ratePerHour} onChange={(e) => setFacilityForm({ ...facilityForm, ratePerHour: e.target.value })} placeholder={t("0 = Free")} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 block">{t("Rules")}</label>
                <input className="input !rounded-xl text-sm font-semibold" value={facilityForm.rules} onChange={(e) => setFacilityForm({ ...facilityForm, rules: e.target.value })} placeholder={t("No shoes, max 2 hours per booking...")} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddFacility(false)} className="btn btn-secondary !rounded-xl !py-2.5 !px-6 text-xs font-bold">{t("Cancel")}</button>
                <button type="submit" disabled={saving} className="btn btn-primary !rounded-xl !py-2.5 !px-6 text-xs font-bold flex items-center gap-2">
                  {saving ? <div className="spinner !w-4 !h-4" /> : <Plus className="w-4 h-4" />}
                  {saving ? t("Adding...") : t("Add Amenity")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
