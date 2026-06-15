"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  Copy,
  Home,
  IndianRupee,
  Smartphone,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface PublicBill {
  id: string;
  flatNumber: string;
  ownerName: string | null;
  societyName: string;
  upiId: string | null;
  description: string | null;
  period: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: string;
  receiptNumber: string | null;
  isPayable: boolean;
}

export default function PublicPayPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<PublicBill | null>(null);
  const [upiDeepLink, setUpiDeepLink] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [paymentStep, setPaymentStep] = useState<"summary" | "upi" | "confirm" | "done">("summary");
  const [utrNumber, setUtrNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  const loadBill = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to load bill");
        setBill(null);
        return;
      }
      setBill(data.bill);
      setUpiDeepLink(data.upiDeepLink || null);
      setTransactionRef(data.transactionRef || "");
      if (!data.bill.isPayable) {
        setPaymentStep("done");
        setReceiptNumber(data.bill.receiptNumber);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  const openUpiApp = () => {
    if (upiDeepLink) {
      window.location.href = upiDeepLink;
      setPaymentStep("confirm");
    }
  };

  const copyUpiId = (upiId: string) => {
    navigator.clipboard.writeText(upiId);
    toast.success("UPI ID copied!");
  };

  const confirmPayment = async () => {
    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      toast.error("Enter your UPI transaction ID (UTR)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pay/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utrNumber: utrNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not record payment");
        return;
      }
      setBill(data.bill);
      setReceiptNumber(data.receiptNumber || data.bill?.receiptNumber || null);
      setPaymentStep("done");
      toast.success("Payment recorded!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-white to-surface">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-primary">
          <Home className="w-5 h-5" />
          <p className="text-sm font-bold">ReManage · Society Payment</p>
        </div>

        {loading ? (
          <div className="card flex justify-center py-16">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <p className="text-lg font-bold text-text-primary mb-2">Link unavailable</p>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
        ) : bill ? (
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-border/40">
            <div className="bg-gradient-to-r from-primary to-primary-light p-6 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white/80 text-xs font-medium">{bill.societyName}</p>
                  <p className="text-white/70 text-xs mt-1">
                    Flat {bill.flatNumber}
                    {bill.ownerName ? ` · ${bill.ownerName}` : ""}
                  </p>
                  <p className="text-3xl font-black mt-3">{formatCurrency(bill.remainingAmount)}</p>
                  <p className="text-white/70 text-xs mt-2">
                    {bill.description || "Society dues"} · {bill.period}
                  </p>
                </div>
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <IndianRupee className="w-5 h-5" />
                </div>
              </div>
              {bill.isPayable && (
                <p className="text-white/70 text-xs mt-3">
                  Due {new Date(bill.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>

            <div className="p-6">
              {paymentStep === "summary" && bill.isPayable && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">
                    Pay without logging in
                  </p>
                  <p className="text-sm text-text-secondary mb-4">
                    Open your UPI app (GPay, PhonePe, Paytm), pay the exact amount, then confirm with your transaction ID.
                  </p>

                  <button
                    onClick={() => {
                      if (upiDeepLink) openUpiApp();
                      else setPaymentStep("upi");
                    }}
                    className="w-full flex items-center justify-between p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Smartphone className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-text-primary">Pay via UPI</p>
                        <p className="text-[10px] text-emerald-600 font-medium">₹0 transaction charges</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </button>

                  <button
                    onClick={() => setPaymentStep("upi")}
                    className="w-full flex items-center justify-between p-4 border border-border/60 rounded-2xl hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center">
                        <Copy className="w-5 h-5 text-text-secondary" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-text-primary">Copy UPI ID</p>
                        <p className="text-[10px] text-text-tertiary">Pay manually from any app</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-text-tertiary" />
                  </button>
                </div>
              )}

              {paymentStep === "upi" && bill.isPayable && (
                <div className="space-y-5">
                  <button
                    onClick={() => setPaymentStep("summary")}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    ← Back
                  </button>

                  <div className="bg-surface/50 rounded-xl p-4 border border-border/40">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">UPI ID</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-mono font-bold text-primary break-all">
                        {bill.upiId || "Not configured — contact society"}
                      </p>
                      {bill.upiId && (
                        <button
                          onClick={() => copyUpiId(bill.upiId!)}
                          className="btn btn-secondary !rounded-xl !py-1.5 !px-3 text-[10px] font-bold shrink-0"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-surface/50 rounded-xl p-4 border border-border/40">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">Exact amount</p>
                    <p className="text-2xl font-bold text-text-primary">{formatCurrency(bill.remainingAmount)}</p>
                    {transactionRef && (
                      <p className="text-[10px] text-text-tertiary mt-1">Ref: {transactionRef}</p>
                    )}
                  </div>

                  {upiDeepLink && (
                    <button
                      onClick={openUpiApp}
                      className="w-full btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                    >
                      <Smartphone className="w-4 h-4" /> Open UPI App & Pay
                    </button>
                  )}

                  <button
                    onClick={() => setPaymentStep("confirm")}
                    className="w-full btn btn-secondary !rounded-xl py-3 text-sm font-bold"
                  >
                    I&apos;ve paid — enter UTR
                  </button>
                </div>
              )}

              {paymentStep === "confirm" && bill.isPayable && (
                <div className="space-y-4">
                  <button
                    onClick={() => setPaymentStep("upi")}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    ← Back
                  </button>
                  <p className="text-sm text-text-secondary">
                    Enter the 12-digit UPI transaction ID from your payment app so the society can verify and issue your receipt.
                  </p>
                  <div>
                    <label className="label">UPI Transaction ID (UTR)</label>
                    <input
                      className="input font-mono"
                      placeholder="e.g. 123456789012"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value.replace(/\s/g, ""))}
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={confirmPayment}
                    disabled={submitting}
                    className="w-full btn btn-primary !rounded-xl py-4 font-bold"
                  >
                    {submitting ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : "Confirm Payment"}
                  </button>
                </div>
              )}

              {paymentStep === "done" && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-black text-text-primary mb-2">
                    {bill.isPayable ? "Payment submitted" : "Already paid"}
                  </h2>
                  <p className="text-sm text-text-secondary mb-4">
                    {bill.isPayable
                      ? "Your payment has been recorded. The treasurer will verify and your receipt will be shared."
                      : "This maintenance bill is already settled. Thank you!"}
                  </p>
                  {(receiptNumber || bill.receiptNumber) && (
                    <p className="text-xs font-mono text-primary bg-primary/5 rounded-xl py-2 px-3 inline-block">
                      Receipt #{receiptNumber || bill.receiptNumber}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <p className="text-center text-[10px] text-text-tertiary mt-6">
          Secure society payment · No app install required
        </p>
      </div>
    </div>
  );
}
