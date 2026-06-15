"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { 
  ArrowLeft, Car, Calendar, Clock, 
  ShieldCheck, MessageSquare, IndianRupee,
  AlertCircle, Share2, Search, Phone, Pencil
} from "lucide-react";
import Link from "next/link";
import DuesEnforcementBanner from "@/components/ux/DuesEnforcementBanner";
import { useDuesEnforcementStatus } from "@/lib/use-dues-enforcement";

interface Listing {
  id: string;
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  description?: string;
  purpose?: string;
  contactPhone?: string | null;
  isPaid: boolean;
  price?: number;
  status: string;
  flat?: { flatNumber: string; ownerName: string };
  requesterFlat?: { flatNumber: string; ownerName: string };
  slot?: { slotNumber: string; slotType: string } | null;
  ownerOccupancy?: { person?: { name: string }, unit?: { flatNumber: string } } | null;
  requests?: Array<{ id: string; requesterFlat?: { flatNumber: string; ownerName: string } }>;
  canManage?: boolean;
}

export default function ParkingMarketplace() {
  const [activeTab, setActiveTab] = useState<"available" | "requests">("available");
  const [shares, setShares] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<"share" | "request" | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [selectedShare, setSelectedShare] = useState<Listing | null>(null);
  const [saving, setSaving] = useState(false);
  const { status: duesStatus, blocked: duesBlocked } = useDuesEnforcementStatus();

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "18:00",
    description: "",
    contactPhone: "",
    price: "0",
    isPaid: false
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parking/marketplace");
      const d = await res.json();
      setShares(d.shares || []);
      setRequests(d.requests || []);
    } catch {
      toast.error("Failed to load marketplace data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = Boolean(editing);
      const res = await fetch("/api/parking/marketplace", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...form, 
          action: isEdit ? (showModal === "share" ? "edit_share" : "edit_request") : undefined,
          sharingId: showModal === "share" && editing ? editing.id : selectedShare?.id || null,
          requestId: showModal === "request" && editing ? editing.id : undefined,
          type: showModal,
          purpose: form.description // API expects description for share, purpose for request
        }),
      });
      if (res.ok) {
        toast.success(showModal === "share" ? "Slot listed for sharing!" : "Parking request posted!");
        setShowModal(null);
        setSelectedShare(null);
        setEditing(null);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to post");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleExchangeAction = async (payload: { requestId?: string; sharingId?: string; action: string }) => {
    try {
      const res = await fetch("/api/parking/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not update parking exchange");
        return;
      }
      toast.success("Parking exchange updated");
      fetchData();
    } catch {
      toast.error("Something went wrong");
    }
  };

  const openRequestForShare = (share: Listing) => {
    setSelectedShare(share);
    setForm((current) => ({
      ...current,
      date: new Date(share.date).toISOString().split("T")[0],
      endDate: new Date(share.endDate || share.date).toISOString().split("T")[0],
      startTime: share.startTime,
      endTime: share.endTime,
      description: "",
      contactPhone: "",
    }));
    setShowModal("request");
  };

  const openEdit = (item: Listing, mode: "share" | "request") => {
    setEditing(item);
    setSelectedShare(null);
    setForm({
      date: new Date(item.date).toISOString().split("T")[0],
      endDate: new Date(item.endDate || item.date).toISOString().split("T")[0],
      startTime: item.startTime,
      endTime: item.endTime,
      description: item.description || item.purpose || "",
      contactPhone: item.contactPhone || "",
      price: String(item.price || 0),
      isPaid: item.isPaid,
    });
    setShowModal(mode);
  };

  const closeModal = () => {
    setShowModal(null);
    setSelectedShare(null);
    setEditing(null);
  };

  const dateRangeLabel = (item: Listing) => {
    const start = new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const end = item.endDate ? new Date(item.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : start;
    return start === end ? start : `${start} to ${end}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link href="/parking" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-border transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tight">Parking Exchange</h1>
            <p className="text-sm text-text-secondary mt-1 font-medium">Share assigned slots or request short-term parking from verified residents</p>
          </div>
        </div>
        <div className="flex gap-2 p-1 bg-surface rounded-xl border border-border">
          <button 
            onClick={() => setActiveTab("available")}
            className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${activeTab === "available" ? "bg-white shadow-md text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
          >
            Available Slots
          </button>
          <button 
            onClick={() => setActiveTab("requests")}
            className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${activeTab === "requests" ? "bg-white shadow-md text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
          >
            Parking Requests
          </button>
        </div>
      </div>

      <DuesEnforcementBanner status={duesStatus} featureLabel="guest parking requests" />

      {/* Hero Action Card */}
      <div className="bg-gradient-to-r from-primary to-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-primary/20 relative overflow-hidden group">
         <div className="absolute -right-20 -bottom-20 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Car className="w-96 h-96 rotate-[-15deg] fill-current" />
         </div>
         <div className="relative z-10 max-w-lg">
            <h2 className="text-4xl font-black mb-4 leading-tight">Use parking without confusion.</h2>
            <p className="text-primary-light font-medium mb-10 opacity-80 leading-relaxed">Residents can share only assigned slots, request parking for guests, and avoid double booking through society rules.</p>
            <div className="flex flex-wrap gap-4">
               <button onClick={() => setShowModal("share")} className="btn !bg-white !text-primary border-none px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-100 transition-all flex items-center gap-2">
                  <Share2 className="w-5 h-5" /> Share Assigned Slot
               </button>
               <button onClick={() => setShowModal("request")} className="btn bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-md px-8 py-4 rounded-2xl font-black flex items-center gap-2" disabled={duesBlocked}>
                  <Search className="w-5 h-5" /> Request Parking
               </button>
            </div>
         </div>
      </div>

      {/* Stats/Legend */}
      <div className="flex flex-wrap gap-4 px-2">
         <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-[0.15em] bg-surface/50 border border-border/50 px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure Exchange
         </div>
         <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-[0.15em] bg-surface/50 border border-border/50 px-4 py-2 rounded-full">
            <MessageSquare className="w-4 h-4 text-primary" /> Direct Chat
         </div>
         <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-[0.15em] bg-surface/50 border border-border/50 px-4 py-2 rounded-full">
            <IndianRupee className="w-4 h-4 text-orange-500" /> Flexible Pricing
         </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2rem] border border-border/50 shadow-xl p-8 min-h-[400px]">
         {loading ? (
           <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="spinner !w-12 !h-12" />
              <p className="text-xs font-black text-text-secondary uppercase tracking-widest">SYNCHRONIZING EXCHANGE...</p>
           </div>
         ) : (activeTab === "available" ? shares : requests).length === 0 ? (
           <div className="text-center py-32 space-y-4">
              <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto mb-6">
                 <AlertCircle className="w-10 h-10 text-text-tertiary opacity-30" />
              </div>
              <p className="text-xl font-bold text-text-primary">Nothing listed here yet!</p>
              <p className="text-sm text-text-secondary max-w-sm mx-auto">Be the first to {activeTab === "available" ? "share your slot" : "request parking"} for the upcoming weekend.</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {(activeTab === "available" ? shares : requests).map((item) => (
                <div key={item.id} className="card !p-0 border-border group hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all overflow-hidden rounded-3xl bg-surface/30">
                   <div className="bg-white p-6">
                      <div className="flex justify-between items-start mb-6">
                         <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black shadow-inner">
                               {item.slot?.slotNumber || (item.flat || item.requesterFlat)?.flatNumber}
                            </div>
                            <div>
                               <p className="text-xs font-black text-text-tertiary uppercase tracking-widest">
                                 {activeTab === "available" ? "Shared By" : "Requested By"}
                               </p>
                               <p className="text-sm font-bold text-text-primary">
                                 {item.ownerOccupancy?.person?.name || (item.flat || item.requesterFlat)?.ownerName || "Verified resident"}
                               </p>
                               <p className="text-[10px] text-text-secondary mt-0.5">
                                 Flat {item.ownerOccupancy?.unit?.flatNumber || (item.flat || item.requesterFlat)?.flatNumber || "-"}
                               </p>
                            </div>
                         </div>
                         <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${item.isPaid ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"}`}>
                            {item.isPaid ? `₹ ${item.price}` : "Free Share"}
                         </div>
                      </div>

                      <div className="space-y-3 mb-8">
                         <div className="flex items-center gap-3 text-text-secondary bg-surface px-4 py-2.5 rounded-xl border border-border/30">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm font-bold">{dateRangeLabel(item)}</span>
                         </div>
                         <div className="flex items-center gap-3 text-text-secondary bg-surface px-4 py-2.5 rounded-xl border border-border/30">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-bold">{item.startTime} — {item.endTime}</span>
                         </div>
                      </div>

                      <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 px-1 mb-8 italic">
                         &ldquo;{item.description || item.purpose || "No additional details provided."}&rdquo;
                      </p>

                      {item.contactPhone && (
                        <a href={`tel:${item.contactPhone}`} className="mb-5 flex items-center gap-3 rounded-xl bg-surface px-4 py-2.5 text-sm font-bold text-text-primary border border-border/30">
                          <Phone className="w-4 h-4 text-primary" />
                          {item.contactPhone}
                        </a>
                      )}

                      {activeTab === "available" && item.requests && item.requests.length > 0 && (
                        <div className="mb-4 rounded-2xl border border-border bg-white p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-2">Pending Requests</p>
                          <div className="space-y-2">
                            {item.requests.map((request) => (
                              <div key={request.id} className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-text-primary">Flat {request.requesterFlat?.flatNumber || "-"}</span>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => handleExchangeAction({ requestId: request.id, action: "accept" })} className="px-2 py-1 rounded-lg bg-success-bg text-success text-[10px] font-black">Accept</button>
                                  <button type="button" onClick={() => handleExchangeAction({ requestId: request.id, action: "reject" })} className="px-2 py-1 rounded-lg bg-danger/10 text-danger text-[10px] font-black">Reject</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => activeTab === "available" ? openRequestForShare(item) : setShowModal("share")}
                        className="w-full btn btn-primary !rounded-2xl py-4 font-black shadow-lg shadow-primary/20 group-hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        {activeTab === "available" ? "Request This Slot" : "Share My Assigned Slot"}
                         <ArrowLeft className="w-4 h-4 rotate-180" />
                      </button>
                      {activeTab === "available" && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {item.canManage && (
                            <button onClick={() => openEdit(item, "share")} className="text-[10px] font-black text-primary hover:underline uppercase flex items-center justify-center gap-1">
                              <Pencil className="w-3 h-3" /> Edit Listing
                            </button>
                          )}
                          {item.canManage && (
                            <button onClick={() => handleExchangeAction({ sharingId: item.id, action: "cancel_share" })} className="text-[10px] font-black text-text-tertiary hover:text-danger uppercase">
                              Cancel Listing
                            </button>
                          )}
                        </div>
                      )}
                      {activeTab === "requests" && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {item.canManage && (
                            <button onClick={() => openEdit(item, "request")} className="text-[10px] font-black text-primary hover:underline uppercase flex items-center justify-center gap-1">
                              <Pencil className="w-3 h-3" /> Edit Request
                            </button>
                          )}
                          {item.canManage && (
                            <button onClick={() => handleExchangeAction({ requestId: item.id, action: "cancel_request" })} className="text-[10px] font-black text-text-tertiary hover:text-danger uppercase">
                              Cancel Request
                            </button>
                          )}
                        </div>
                      )}
                   </div>
                </div>
             ))}
           </div>
         )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-md z-[100] p-4" onClick={closeModal}>
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] !p-10 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Background design element */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-10">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${showModal === 'share' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    {showModal === 'share' ? <Share2 className="w-7 h-7" /> : <Search className="w-7 h-7" />}
                 </div>
                 <div>
                    <h3 className="text-3xl font-black text-text-primary tracking-tighter">
                      {editing ? "Edit Parking Window" : showModal === "share" ? "Share Assigned Slot" : selectedShare ? "Request This Slot" : "Request Parking"}
                    </h3>
                    <p className="text-sm font-medium text-text-secondary mt-1">
                      {showModal === "share" ? "Only your active assigned slot can be shared" : "Committee can audit every request and response"}
                    </p>
                 </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">From Date</label>
                      <input 
                        type="date" 
                        min={new Date().toISOString().split("T")[0]}
                        className="input !rounded-2xl !bg-surface/50 !border-border/60 p-4 font-black" 
                        value={form.date} 
                        onChange={(e) => setForm({ ...form, date: e.target.value })} 
                        required 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">Till Date</label>
                      <input
                        type="date"
                        min={form.date}
                        className="input !rounded-2xl !bg-surface/50 !border-border/60 p-4 font-black"
                        value={form.endDate}
                        onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                        required
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4 md:col-span-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">From</label>
                        <input className="input !rounded-2xl !bg-surface/50 !border-border/60 p-4 font-black" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">Till</label>
                        <input className="input !rounded-2xl !bg-surface/50 !border-border/60 p-4 font-black" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                      </div>
                   </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">Contact Number</label>
                  <input
                    type="tel"
                    className="input !rounded-2xl !bg-surface/50 !border-border/60 p-4 font-black"
                    placeholder="Mobile number for coordination"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-tertiary ml-1">
                    {showModal === 'share' ? 'Notes for users' : 'Why do you need this?'}
                  </label>
                  <textarea 
                    className="input !rounded-2xl !bg-surface/50 !border-border/60 p-4 min-h-[120px] font-medium resize-none" 
                    placeholder={showModal === 'share' ? "e.g. My car is being serviced so slot is empty all day." : "e.g. My cousin is visiting for dinner with his SUV."}
                    value={form.description} 
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between bg-surface/50 p-6 rounded-3xl border border-border/40">
                   <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        id="isPaid"
                        checked={form.isPaid}
                        onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
                        className="w-5 h-5 rounded-lg border-2 border-primary accent-primary" 
                      />
                      <label htmlFor="isPaid" className="text-sm font-bold text-text-primary cursor-pointer">Paid Transaction</label>
                   </div>
                   {form.isPaid && (
                     <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                        <span className="text-lg font-black text-orange-600">₹</span>
                        <input 
                          type="number" 
                          className="w-24 bg-transparent text-lg font-black text-orange-600 border-b-2 border-orange-200 focus:border-orange-500 outline-none transition-colors" 
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                        />
                     </div>
                   )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 btn btn-secondary !rounded-[1.25rem] py-4 font-black">Discard</button>
                  <button type="submit" disabled={saving || (duesBlocked && showModal === "request")} className="flex-[2] btn btn-primary !rounded-[1.25rem] py-4 font-black shadow-xl shadow-primary/30">
                    {saving ? "Saving..." : editing ? "Save Changes" : showModal === 'share' ? "List Available Slot" : "Post Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
