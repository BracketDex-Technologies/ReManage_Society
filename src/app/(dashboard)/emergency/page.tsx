"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Phone, Shield, Flame, Heart, AlertTriangle, Siren, Plus, X, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ModuleEmptyState, ModulePageHeader } from "@/components/ux/ModulePageKit";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  category: string;
  address: string | null;
}

interface Responder {
  name: string;
  phone: string;
  role: string;
}

const sosTypes = [
  { key: "fire", label: "Fire", icon: Flame, color: "bg-orange-600", ring: "hover:ring-orange-300" },
  { key: "medical", label: "Medical", icon: Heart, color: "bg-red-600", ring: "hover:ring-red-300" },
  { key: "security", label: "Security", icon: Shield, color: "bg-blue-600", ring: "hover:ring-blue-300" },
  { key: "other", label: "Other", icon: AlertTriangle, color: "bg-gray-700", ring: "hover:ring-gray-300" },
];

const helplines = [
  { name: "Police", number: "100", icon: Shield },
  { name: "Fire Brigade", number: "101", icon: Flame },
  { name: "Ambulance", number: "102", icon: Heart },
  { name: "Women Helpline", number: "1091", icon: Phone },
  { name: "Disaster Mgmt", number: "108", icon: AlertTriangle },
] satisfies Array<{ name: string; number: string; icon: LucideIcon }>;

export default function EmergencyPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [sosMessage, setSosMessage] = useState("");
  const [responders, setResponders] = useState<Responder[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", category: "security", address: "" });
  const [savingContact, setSavingContact] = useState(false);

  const fetchContacts = useCallback(() => {
    setLoading(true);
    fetch("/api/emergency")
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const triggerSOS = async (type: string) => {
    setSending(true);
    try {
      const res = await fetch("/api/emergency/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: sosMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Emergency alert sent to all committee members");
        setResponders(data.responders || []);
        setShowConfirm(null);
        setSosMessage("");
      } else {
        toast.error(data.error || "Failed to send alert");
      }
    } catch { toast.error("Network error"); }
    finally { setSending(false); }
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContact(true);
    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        toast.success("Contact saved");
        setShowAddContact(false);
        setContactForm({ name: "", phone: "", category: "security", address: "" });
        fetchContacts();
      }
    } catch { toast.error("Failed"); }
    finally { setSavingContact(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      <ModulePageHeader
        icon={Siren}
        title="Emergency & SOS"
        description="Send urgent alerts and reach society or national responders quickly."
        meta={`${contacts.length} contacts`}
        tone="red"
      />

      {/* SOS Buttons */}
      <div className="bg-white rounded-[1.5rem] border border-red-200 p-6 sm:p-8">
        <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-5 text-center">Tap to send emergency alert</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {sosTypes.map((sos) => (
            <button
              key={sos.key}
              onClick={() => setShowConfirm(sos.key)}
              className={`${sos.color} text-white p-5 sm:p-6 rounded-2xl flex flex-col items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all ring-4 ring-transparent ${sos.ring}`}
            >
              <sos.icon className="w-8 h-8 sm:w-10 sm:h-10" />
              <span className="font-bold text-sm sm:text-base">{sos.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Responders (after alert sent) */}
      {responders.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-emerald-800 mb-3">Alert sent to {responders.length} responders:</p>
          <div className="space-y-2">
            {responders.map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl p-3 border border-emerald-100">
                <div>
                  <p className="text-sm font-bold text-text-primary">{r.name}</p>
                  <p className="text-[10px] text-text-tertiary uppercase">{r.role}</p>
                </div>
                <a href={`tel:${r.phone}`} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* National Helplines */}
      <div>
        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-3 px-1">NATIONAL HELPLINES</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {helplines.map((h) => (
            <a key={h.number} href={`tel:${h.number}`} className="bg-white rounded-2xl border border-border/50 p-4 flex items-center gap-3 hover:shadow-sm hover:border-primary/20 transition-all">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <h.icon className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">{h.name}</p>
                <p className="text-lg font-bold text-primary">{h.number}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Society Emergency Contacts */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">SOCIETY CONTACTS</p>
          <button onClick={() => setShowAddContact(true)} className="text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner !w-6 !h-6" /></div>
        ) : contacts.length === 0 ? (
          <ModuleEmptyState icon={Phone} title="No society contacts yet" description="Add security, medical, or maintenance contacts for residents." tone="red" />
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-border/50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text-primary">{c.name}</p>
                  <p className="text-[10px] text-text-tertiary">{c.category} {c.address ? `· ${c.address}` : ""}</p>
                </div>
                <a href={`tel:${c.phone}`} className="btn btn-primary !rounded-xl !py-2 !px-4 text-xs font-bold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {c.phone}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOS Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowConfirm(null)}>
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Siren className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">Confirm Emergency Alert?</h3>
              <p className="text-xs text-text-secondary mt-1">This will notify all committee members and guards immediately</p>
            </div>
            <input className="input !rounded-xl !bg-surface font-semibold text-sm px-4 py-3 mb-4 w-full" placeholder="Optional: describe the situation..." value={sosMessage} onChange={(e) => setSosMessage(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(null)} className="flex-1 btn btn-secondary !rounded-xl py-3.5 font-bold text-sm">Cancel</button>
              <button onClick={() => triggerSOS(showConfirm)} disabled={sending} className="flex-[2] bg-red-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-xl shadow-red-600/30 flex items-center justify-center gap-2">
                {sending ? <Clock className="w-4 h-4 animate-spin" /> : <Siren className="w-4 h-4" />}
                {sending ? "Sending..." : "SEND ALERT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="modal-overlay !bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setShowAddContact(false)}>
          <div className="bg-white w-full max-w-sm sm:rounded-[2rem] h-full sm:h-auto overflow-y-auto !p-6 sm:!p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Add Emergency Contact</h3>
              <button onClick={() => setShowAddContact(false)} className="p-2 rounded-full hover:bg-surface"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveContact} className="space-y-4">
              <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 w-full" placeholder="Contact Name *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required />
              <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 w-full" placeholder="Phone *" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} required />
              <select className="select !rounded-xl !bg-surface font-bold text-sm py-3.5 px-4 w-full" value={contactForm.category} onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })}>
                <option value="security">Security</option>
                <option value="medical">Medical</option>
                <option value="fire">Fire</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="other">Other</option>
              </select>
              <input className="input !rounded-xl !bg-surface font-bold text-sm px-4 py-3.5 w-full" placeholder="Address (optional)" value={contactForm.address} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} />
              <button type="submit" disabled={savingContact} className="w-full btn btn-primary !rounded-xl py-3.5 font-bold text-sm">{savingContact ? "Saving..." : "Save Contact"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
