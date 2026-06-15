"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Send, Check, X, MessageSquare } from "lucide-react";
import { formatCurrency, formatPeriod, formatDate } from "@/lib/utils";
import { useUser } from "@/lib/user-context";
import { defaultTemplates, fillTemplate } from "@/lib/whatsapp";

interface PendingFlat {
  id: string;
  flatId: string;
  flatNumber: string;
  ownerName: string;
  contact: string;
  amount: number;
  dueDate: string;
  lastReminder: string | null;
  sent?: boolean;
  failed?: boolean;
}


export default function RemindersPage() {
  const [pendingFlats, setPendingFlats] = useState<PendingFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [template, setTemplate] = useState(defaultTemplates.english);
  const [lang, setLang] = useState<"english" | "marathi">("english");
  const { user } = useUser();
  const [useApi, setUseApi] = useState(false);
  const [sending, setSending] = useState(false);

  const period = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  const periodLabel = (() => {
    const [y, m] = period.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  })();



  interface BillRecord {
    id: string;
    flatId: string;
    amount: number;
    status: string;
    paidAmount: number | null;
    dueDate: string;
    flat: { id: string; flatNumber: string; ownerName: string; contact: string };
  }

  const fetchPending = useCallback(() => {
    fetch(`/api/maintenance/bills?period=${period}`)
      .then((r) => r.json())
      .then((data) => {
        const flats = (data.bills || [])
          .filter((b: BillRecord) => b.status === "pending" || b.status === "partial")
          .map((b: BillRecord) => ({
            id: b.id,
            flatId: b.flat.id,
            flatNumber: b.flat.flatNumber,
            ownerName: b.flat.ownerName,
            contact: b.flat.contact,
            amount: b.status === "partial" && b.paidAmount ? b.amount - b.paidAmount : b.amount,
            dueDate: b.dueDate,
            lastReminder: null,
          }));
        setPendingFlats(flats);
      })
      .catch(() => toast.error("Failed to load pending bills"))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Build a WhatsApp message for a flat
  const buildMessage = (flat: PendingFlat) => {
    return fillTemplate(template, {
      ownerName: flat.ownerName,
      flatNumber: flat.flatNumber,
      societyName: user.societyName || "Society",
      amount: flat.amount.toString(),
      period: formatPeriod(period),
      dueDate: formatDate(flat.dueDate),
      upiId: user.societyUpiId || "N/A",
      chairmanName: user.name || "Chairman",
    });
  };

  // Send via wa.me link (always works, no API needed)
  const sendViaWhatsApp = (flat: PendingFlat) => {
    const message = buildMessage(flat);
    const phone = flat.contact.replace(/\D/g, "");
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    // Mark as sent in UI
    setPendingFlats((prev) =>
      prev.map((f) =>
        f.flatId === flat.flatId ? { ...f, sent: true, lastReminder: "Just now" } : f
      )
    );
    toast.success(`WhatsApp opened for ${flat.ownerName}`);
  };

  // Send via API (requires WhatsApp Business API credentials)
  const sendViaApi = async (flatIds: string[]) => {
    try {
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flatIds, templateBody: template, period }),
      });
      const data = await res.json();

      if (data.sent > 0) {
        toast.success(`Reminders sent to ${data.sent} members`);
        setPendingFlats((prev) =>
          prev.map((f) =>
            flatIds.includes(f.flatId)
              ? { ...f, sent: true, lastReminder: "Just now" }
              : f
          )
        );
      } else {
        toast.error(data.error || "Failed to send reminders");
        setPendingFlats((prev) =>
          prev.map((f) =>
            flatIds.includes(f.flatId) ? { ...f, failed: true } : f
          )
        );
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const sendSingle = async (flat: PendingFlat) => {
    setSendingId(flat.flatId);
    if (useApi) {
      await sendViaApi([flat.flatId]);
    } else {
      sendViaWhatsApp(flat);
    }
    setSendingId(null);
  };

  const sendAll = async () => {
    setSending(true);
    if (useApi) {
      await sendViaApi(pendingFlats.filter((f) => !f.sent).map((f) => f.flatId));
    } else {
      // Open wa.me links one by one with delay
      const unsent = pendingFlats.filter((f) => !f.sent);
      for (const flat of unsent) {
        sendViaWhatsApp(flat);
        // Small delay so browser doesn't block popups
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    setSending(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Send Payment Reminders</h1>
          <p className="text-sm text-text-secondary mt-1">
            {periodLabel} — {pendingFlats.length} flats have pending maintenance
          </p>
        </div>
        <button
          onClick={sendAll}
          disabled={sending || pendingFlats.length === 0}
          className="btn btn-primary"
        >
          {sending ? (
            <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send to all {pendingFlats.filter((f) => !f.sent).length} pending
            </>
          )}
        </button>
      </div>

      {/* Sending Mode Toggle */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Sending Method</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {useApi
                ? "Using WhatsApp Business API (auto-sends without opening WhatsApp)"
                : "Opens WhatsApp with pre-filled message (recommended)"}
            </p>
          </div>
          <div className="flex gap-1 bg-surface rounded-lg p-0.5">
            <button
              onClick={() => setUseApi(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                !useApi ? "bg-white text-primary shadow-sm" : "text-text-secondary"
              }`}
            >
              Direct Link
            </button>
            <button
              onClick={() => setUseApi(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                useApi ? "bg-white text-primary shadow-sm" : "text-text-secondary"
              }`}
            >
              API (Business)
            </button>
          </div>
        </div>
      </div>

      {/* Template Editor */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Message Template</h3>
          </div>
          <div className="flex gap-1 bg-surface rounded-lg p-0.5">
            {(["english", "marathi"] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  setTemplate(defaultTemplates[l]);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  lang === l ? "bg-white text-primary shadow-sm" : "text-text-secondary"
                }`}
              >
                {l === "english" ? "English" : "मराठी"}
              </button>
            ))}
          </div>
        </div>
        <textarea
          className="input !h-auto font-mono text-xs"
          rows={8}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
        <p className="text-xs text-text-secondary mt-2">
          Variables: {"{ownerName}"}, {"{flatNumber}"}, {"{societyName}"},{" "}
          {"{amount}"}, {"{period}"}, {"{dueDate}"}, {"{upiId}"},{" "}
          {"{chairmanName}"}
        </p>
      </div>

      {/* Pending Flats List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : pendingFlats.length === 0 ? (
        <div className="card text-center py-12 text-text-secondary">
          <p>🎉 No pending payments! All flats have paid for {periodLabel}.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Flat</th>
                <th>Owner</th>
                <th>Amount</th>
                <th className="hidden sm:table-cell">Last Reminder</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingFlats.map((f) => (
                <tr key={f.id}>
                  <td className="font-medium">{f.flatNumber}</td>
                  <td>{f.ownerName}</td>
                  <td>{formatCurrency(f.amount)}</td>
                  <td className="hidden sm:table-cell text-text-secondary">
                    {f.lastReminder || "Never"}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      {f.sent ? (
                        <span className="flex items-center gap-1 text-xs text-success font-medium">
                          <Check className="w-3 h-3" /> Sent
                        </span>
                      ) : f.failed ? (
                        <span className="flex items-center gap-1 text-xs text-danger font-medium">
                          <X className="w-3 h-3" /> Failed
                        </span>
                      ) : (
                        <button
                          onClick={() => sendSingle(f)}
                          disabled={sendingId === f.flatId}
                          className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                        >
                          {sendingId === f.flatId ? (
                            <div className="spinner !w-3 !h-3" />
                          ) : (
                            <><Send className="w-3 h-3" /> Send</>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
