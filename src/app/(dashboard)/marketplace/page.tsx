"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Plus, Tag, X, Package, Image as ImageIcon, Trash2, Handshake, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { useAppDialog } from "@/components/ui/AppDialogProvider";
import { ModuleEmptyState, ModulePageHeader, ModuleSectionTitle } from "@/components/ux/ModulePageKit";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string;
  condition: string;
  status: string;
  contactPhone: string | null;
  flatNumber: string | null;
  createdAt: string;
  userId: string;
  isMine?: boolean;
  myInterestStatus?: string | null;
  images?: { id: string; url: string; sortOrder: number }[];
  interests?: MarketplaceInterest[];
}

interface MarketplaceInterest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  person: {
    id: string;
    name: string;
    phone: string | null;
    users: { id: string; email: string; flat: { flatNumber: string } | null }[];
  } | null;
}

const CATEGORIES = [
  { value: "furniture", label: "Furniture" },
  { value: "electronics", label: "Electronics" },
  { value: "appliances", label: "Appliances" },
  { value: "clothing", label: "Clothing" },
  { value: "books", label: "Books" },
  { value: "vehicles", label: "Vehicles" },
  { value: "services", label: "Services" },
  { value: "general", label: "General" },
];

const CONDITIONS = [
  { value: "new", label: "Brand New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Needs Repair" },
];

export default function MarketplacePage() {
  const { prompt } = useAppDialog();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    title: "", description: "", price: "", category: "general",
    condition: "good", contactPhone: "", flatNumber: "", imageCount: "0",
    imageUrls: [] as string[],
  });

  const fetchListings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace");
      const d = await res.json();
      if (Array.isArray(d)) setListings(d);
    } catch {
      toast.error("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchListings(); }, []);

  const handlePost = async () => {
    if (!form.title) return toast.error("Title is required");
    const load = toast.loading("Posting listing...");
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Listed successfully!", { id: load });
        setShowForm(false);
        setForm({ title: "", description: "", price: "", category: "general", condition: "good", contactPhone: "", flatNumber: "", imageCount: "0", imageUrls: [] });
        fetchListings();
      } else {
        toast.error("Failed to post", { id: load });
      }
    } catch {
      toast.error("Error", { id: load });
    }
  };

  const updatePhotoCount = (count: string) => {
    const nextCount = Number(count);
    setForm((current) => ({
      ...current,
      imageCount: count,
      imageUrls: current.imageUrls.slice(0, nextCount),
    }));
  };

  const handlePhotoChange = (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 1_500_000) {
      toast.error("Photo must be under 1.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => {
        const imageUrls = [...current.imageUrls];
        imageUrls[index] = String(reader.result || "");
        return { ...current, imageUrls };
      });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    setForm((current) => {
      const imageUrls = [...current.imageUrls];
      imageUrls[index] = "";
      return { ...current, imageUrls };
    });
  };

  const handleRequestBuy = async (listing: Listing) => {
    const message = await prompt({
      title: "Request to Buy",
      message: `Send a short message to the seller for "${listing.title}".`,
      label: "Message to Seller",
      defaultValue: "I am interested. Please contact me.",
      placeholder: "Write your message...",
      confirmLabel: "Send Request",
      multiline: true,
      required: true,
    });
    if (message === null) return;
    const load = toast.loading("Sending buy request...");
    try {
      const res = await fetch(`/api/marketplace/${listing.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Buy request sent to seller", { id: load });
        fetchListings();
      } else {
        toast.error(data.error || "Failed to send request", { id: load });
      }
    } catch {
      toast.error("Failed to send request", { id: load });
    }
  };

  const handleInterestDecision = async (listingId: string, interestId: string, decision: "accept_interest" | "reject_interest") => {
    const load = toast.loading(decision === "accept_interest" ? "Accepting request..." : "Rejecting request...");
    try {
      const res = await fetch(`/api/marketplace/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: decision, interestId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(decision === "accept_interest" ? "Request accepted" : "Request rejected", { id: load });
        fetchListings();
      } else {
        toast.error(data.error || "Failed to update request", { id: load });
      }
    } catch {
      toast.error("Failed to update request", { id: load });
    }
  };

  const handleMarkSold = async (id: string) => {
    try {
      const res = await fetch(`/api/marketplace/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sold" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Marked as sold");
        fetchListings();
      } else {
        toast.error(data.error || "Failed to mark sold");
      }
    } catch {
      toast.error("Failed to update");
    }
  };

  const filtered = filter === "all" ? listings : listings.filter(l => l.category === filter);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        icon={ShoppingBag}
        title="Community Marketplace"
        description="Buy, sell, exchange, and manage neighbour-to-neighbour requests."
        meta={`${listings.length} listings`}
        tone="violet"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm flex items-center gap-2 !rounded-xl px-5 py-2.5 font-bold">
            {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Post Listing</>}
          </button>
        }
      />

      {showForm && (
        <div className="card animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sm mb-4">Post an Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Title *</label>
              <input className="input" placeholder="e.g. L-shaped Sofa Set" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea className="input min-h-[80px]" placeholder="Describe the item, its condition, and why you're selling..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Price (₹)</label>
              <input type="number" className="input" placeholder="Leave empty for Free / Exchange" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Condition</label>
              <select className="select" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Contact Phone</label>
              <input className="input" placeholder="Optional" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            <div>
              <label className="label">Flat Number</label>
              <input className="input" placeholder="e.g. A-101" value={form.flatNumber} onChange={e => setForm({ ...form, flatNumber: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Number of Photos</label>
              <select className="select" value={form.imageCount} onChange={(e) => updatePhotoCount(e.target.value)}>
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>{count === 0 ? "No photos" : `${count} photo${count > 1 ? "s" : ""}`}</option>
                ))}
              </select>
              <p className="text-xs text-text-secondary mt-1">Select how many photos you want to add, then upload that many item photos.</p>
            </div>
            {Number(form.imageCount) > 0 && (
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: Number(form.imageCount) }).map((_, index) => (
                  <div key={index} className="rounded-xl border border-border bg-surface p-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Photo {index + 1}</label>
                    {form.imageUrls[index] ? (
                      <div className="mt-2 relative overflow-hidden rounded-xl border border-border bg-white">
                        <img src={form.imageUrls[index]} alt={`Listing photo ${index + 1}`} className="h-28 w-full object-cover" />
                        <button type="button" onClick={() => removePhoto(index)} className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-danger shadow-sm">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="mt-2 flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white text-xs font-bold text-text-secondary">
                        <ImageIcon className="mb-2 h-5 w-5" />
                        Add Photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(index, e.target.files?.[0])} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={handlePost} className="btn btn-primary">Post Listing</button>
          </div>
        </div>
      )}

      <ModuleSectionTitle title="Browse Listings" description={`${filtered.length} matching item${filtered.length === 1 ? "" : "s"}`} />

      <div className="flex flex-wrap gap-2 rounded-[1.5rem] border border-border/60 bg-white p-3 shadow-sm dark:bg-[#1E1E1E]">
        <button onClick={() => setFilter("all")} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${filter === "all" ? "bg-primary text-white" : "bg-surface border border-border text-text-secondary hover:bg-primary/10"}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setFilter(c.value)} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${filter === c.value ? "bg-primary text-white" : "bg-surface border border-border text-text-secondary hover:bg-primary/10"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <ModuleEmptyState
          icon={Package}
          title="No listings found"
          description="Post an item or switch categories to browse more neighbour listings."
          tone="violet"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(l => (
            <div key={l.id} className="card overflow-hidden hover:shadow-lg transition-shadow">
              {l.status === "reserved" && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  Reserved after seller approval
                </div>
              )}
              {l.images?.[0]?.url && (
                <img src={l.images[0].url} alt={l.title} className="mb-4 h-44 w-full rounded-xl object-cover border border-border" />
              )}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-base">{l.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs uppercase font-medium bg-surface px-2 py-0.5 rounded-md border border-border">{l.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${l.condition === "new" ? "bg-success/10 text-success" : l.condition === "like_new" ? "bg-primary/10 text-primary" : "bg-surface border border-border text-text-secondary"}`}>
                      {CONDITIONS.find(c => c.value === l.condition)?.label || l.condition}
                    </span>
                  </div>
                </div>
                <Tag className="w-4 h-4 text-text-secondary" />
              </div>
              {l.description && <p className="text-sm text-text-secondary mb-3 line-clamp-2">{l.description}</p>}
              {l.images && l.images.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {l.images.slice(1).map((image, index) => (
                    <img key={image.id || index} src={image.url} alt={`${l.title} photo ${index + 2}`} className="h-14 w-14 shrink-0 rounded-lg object-cover border border-border" />
                  ))}
                </div>
              )}
              {l.isMine && (
                <div className="mb-3 rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Buy Requests</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-text-secondary ring-1 ring-border">
                      {l.interests?.filter((interest) => interest.status !== "rejected").length || 0}
                    </span>
                  </div>
                  {!l.interests?.length ? (
                    <p className="mt-2 text-xs text-text-secondary">No buyer requests yet.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {l.interests.map((interest) => (
                        <div key={interest.id} className="rounded-lg bg-white p-2 ring-1 ring-border">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text-primary truncate">{interest.person?.name || "Interested buyer"}</p>
                              <p className="text-[10px] text-text-secondary truncate">
                                {interest.person?.phone || interest.person?.users?.[0]?.email || "Contact hidden"}
                                {interest.person?.users?.[0]?.flat?.flatNumber ? ` · Flat ${interest.person.users[0].flat.flatNumber}` : ""}
                              </p>
                              {interest.message && <p className="mt-1 text-[10px] text-text-secondary line-clamp-2">{interest.message}</p>}
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              interest.status === "accepted" ? "bg-emerald-50 text-emerald-700" :
                              interest.status === "rejected" ? "bg-red-50 text-red-700" :
                              "bg-blue-50 text-blue-700"
                            }`}>
                              {interest.status}
                            </span>
                          </div>
                          {interest.status === "interested" && l.status !== "sold" && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button onClick={() => handleInterestDecision(l.id, interest.id, "accept_interest")} className="rounded-lg bg-emerald-600 px-2 py-2 text-[10px] font-bold text-white flex items-center justify-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5" /> Accept
                              </button>
                              <button onClick={() => handleInterestDecision(l.id, interest.id, "reject_interest")} className="rounded-lg bg-red-50 px-2 py-2 text-[10px] font-bold text-red-700 flex items-center justify-center gap-1">
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-end mt-auto pt-3 border-t border-border">
                <div>
                  <p className="text-lg font-bold text-primary">{l.price ? formatCurrency(l.price) : "Free"}</p>
                  {l.flatNumber && <p className="text-xs text-text-secondary">Flat: {l.flatNumber}</p>}
                </div>
                {l.isMine ? (
                  <button onClick={() => handleMarkSold(l.id)} className="text-xs text-success hover:underline font-medium">Mark Sold</button>
                ) : l.myInterestStatus ? (
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${
                    l.myInterestStatus === "accepted" ? "bg-emerald-50 text-emerald-700" :
                    l.myInterestStatus === "rejected" ? "bg-red-50 text-red-700" :
                    "bg-blue-50 text-blue-700"
                  }`}>
                    {l.myInterestStatus === "interested" ? "Requested" : l.myInterestStatus}
                  </span>
                ) : (
                  <button onClick={() => handleRequestBuy(l)} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white flex items-center gap-1.5">
                    <Handshake className="h-3.5 w-3.5" /> Request Buy
                  </button>
                )}
              </div>
              <p className="text-[10px] text-text-tertiary mt-2">{new Date(l.createdAt).toLocaleDateString("en-IN")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
