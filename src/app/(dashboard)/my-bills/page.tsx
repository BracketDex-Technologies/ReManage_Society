"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { Receipt, Download, AlertTriangle, IndianRupee, Wallet, Smartphone, Copy, CheckCircle, X, ArrowRight, Home, UserRound, HandCoins } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import Link from "next/link";
import PageState from "@/components/ux/PageState";
import { LIVE_FAST_INTERVAL_MS } from "@/lib/live-refresh";

interface MyBill {
  id: string;
  amount: number;
  billType?: string;
  billingCycle?: string;
  description?: string | null;
  lateFee: number;
  gstAmount: number;
  totalAmount: number | null;
  period: string;
  dueDate: string;
  status: string;
  paidAt: string | null;
  paidVia: string | null;
  paidAmount: number | null;
  receiptNumber: string | null;
  flat: {
    flatNumber: string;
    ownerName: string;
  };
  society: {
    upiId: string;
    bankDetails: string;
    name: string;
  };
}

interface RentInvoice {
  id: string;
  period: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  paidVia: string | null;
  paidAmount: number | null;
  receiptNumber: string | null;
  receiptNote?: string | null;
  tenant: {
    name: string;
    phone: string;
  };
  flat: {
    flatNumber: string;
    wing: string | null;
  };
  owner?: {
    name: string;
    phone: string | null;
    email: string;
  } | null;
}

interface OwnerRental {
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string | null;
  flatNumber: string;
  wing: string | null;
  monthlyRent: number;
  leaseStart: string;
  leaseEnd: string | null;
  invoices: RentInvoice[];
}

interface LinkedStaff {
  id: string;
  name: string;
  phone: string;
  category: string;
  schedule: string | null;
  agreedMonthlyPay: number | null;
}

interface ResidentStaffPayment {
  id: string;
  month: string;
  amount: number;
  status: string;
  paidOn: string | null;
  paidVia: string | null;
  note: string | null;
  staff: {
    id: string;
    name: string;
    phone: string;
    category: string;
  };
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function MyBillsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [bills, setBills] = useState<MyBill[]>([]);
  const [stats, setStats] = useState({ totalPending: 0, totalPaid: 0 });
  const [rentStats, setRentStats] = useState({ rentPending: 0, rentPaid: 0, ownerPending: 0, ownerReceived: 0 });
  const [ownerRentals, setOwnerRentals] = useState<OwnerRental[]>([]);
  const [tenantRentInvoices, setTenantRentInvoices] = useState<RentInvoice[]>([]);
  const [linkedStaff, setLinkedStaff] = useState<LinkedStaff[]>([]);
  const [staffPayments, setStaffPayments] = useState<ResidentStaffPayment[]>([]);
  const [staffStats, setStaffStats] = useState({ pending: 0, paid: 0, linkedStaff: 0 });
  const [loading, setLoading] = useState(true);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<MyBill | null>(null);
  const [paymentStep, setPaymentStep] = useState<"choose" | "upi" | "confirm">("choose");
  const [utrNumber, setUtrNumber] = useState("");
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [selectedRental, setSelectedRental] = useState<OwnerRental | null>(null);
  const [rentForm, setRentForm] = useState({ period: "", amount: "", dueDate: "" });
  const [savingRent, setSavingRent] = useState(false);
  const [staffForm, setStaffForm] = useState({ staffId: "", month: "", amount: "", note: "" });
  const [savingStaffPayment, setSavingStaffPayment] = useState(false);

  const fetchBills = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch("/api/my-bills");
      const data = await res.json();
      if (data.bills) {
        setBills(data.bills);
        setStats(data.stats);
      }
      const rentRes = await fetch("/api/rent-invoices");
      const rentData = await rentRes.json();
      if (rentRes.ok) {
        setOwnerRentals(rentData.ownerRentals || []);
        setTenantRentInvoices(rentData.tenantRentInvoices || []);
        setRentStats(rentData.stats || { rentPending: 0, rentPaid: 0, ownerPending: 0, ownerReceived: 0 });
      }
      const staffRes = await fetch("/api/staff/payments");
      const staffData = await staffRes.json();
      if (staffRes.ok) {
        setLinkedStaff(staffData.linkedStaff || []);
        setStaffPayments(staffData.payments || []);
        setStaffStats(staffData.stats || { pending: 0, paid: 0, linkedStaff: 0 });
        setStaffForm((current) => ({ ...current, month: current.month || staffData.defaultMonth || currentPeriod() }));
      }
    } catch {
      if (!isBackground) toastT.error("Failed to load your bills");
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
    const refresh = () => fetchBills(true);
    const interval = window.setInterval(refresh, LIVE_FAST_INTERVAL_MS);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [fetchBills]);

  const handlePayClick = (bill: MyBill) => {
    setSelectedBill(bill);
    setPaymentStep("choose");
    setUtrNumber("");
    setShowPaymentModal(true);
  };

  const defaultDueDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.min(now.getDate(), 28)).padStart(2, "0")}`;
  };

  const openRentModal = (rental: OwnerRental) => {
    setSelectedRental(rental);
    setRentForm({
      period: currentPeriod(),
      amount: rental.monthlyRent ? String(rental.monthlyRent) : "",
      dueDate: defaultDueDate(),
    });
  };

  const createRentInvoice = async () => {
    if (!selectedRental) return;
    if (!rentForm.period || !rentForm.amount || !rentForm.dueDate) {
      toastT.error("Period, amount and due date are required");
      return;
    }
    setSavingRent(true);
    try {
      const res = await fetch("/api/rent-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selectedRental.tenantId,
          period: rentForm.period,
          amount: rentForm.amount,
          dueDate: rentForm.dueDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Private rent invoice raised");
        setSelectedRental(null);
        fetchBills();
      } else {
        toastT.error(data.error || "Failed to raise rent invoice");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setSavingRent(false);
    }
  };

  const markRentPaid = async (invoiceId: string) => {
    setSavingRent(true);
    try {
      const res = await fetch("/api/rent-invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action: "mark_paid", paidVia: "private", receiptNote: "Recorded by owner" }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Private rent payment recorded");
        fetchBills();
      } else {
        toastT.error(data.error || "Failed to update rent invoice");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setSavingRent(false);
    }
  };

  const payPrivateRent = async (invoiceId: string) => {
    setSavingRent(true);
    try {
      const res = await fetch("/api/rent-invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action: "tenant_pay", paidVia: "tenant_payment" }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Private rent paid. Owner has been notified.");
        fetchBills();
      } else {
        toastT.error(data.error || "Failed to pay rent");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setSavingRent(false);
    }
  };

  const createStaffPayment = async () => {
    if (!staffForm.staffId || !staffForm.month || !staffForm.amount) {
      toastT.error("Select staff, month and amount");
      return;
    }
    setSavingStaffPayment(true);
    try {
      const res = await fetch("/api/staff/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffForm),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Staff payment entry added");
        setStaffForm({ staffId: "", month: currentPeriod(), amount: "", note: "" });
        fetchBills();
      } else {
        toastT.error(data.error || "Failed to add staff payment");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setSavingStaffPayment(false);
    }
  };

  const markStaffPaymentPaid = async (paymentId: string) => {
    setSavingStaffPayment(true);
    try {
      const res = await fetch("/api/staff/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, action: "mark_paid", paidVia: "cash" }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Staff payment marked paid");
        fetchBills();
      } else {
        toastT.error(data.error || "Failed to update staff payment");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setSavingStaffPayment(false);
    }
  };

  // Generate UPI deep link URI
  const generateUpiLink = (bill: MyBill): string => {
    const amount = (bill.totalAmount || bill.amount + bill.lateFee + bill.gstAmount).toFixed(2);
    const upiId = bill.society?.upiId || "";
    const payeeName = encodeURIComponent(bill.society?.name || "Society");
    const transactionRef = encodeURIComponent(`MAINT-${bill.period}-${bill.flat.flatNumber}`);
    const transactionNote = encodeURIComponent(`Maintenance ${bill.period} - Flat ${bill.flat.flatNumber}`);
    return `upi://pay?pa=${upiId}&pn=${payeeName}&tr=${transactionRef}&tn=${transactionNote}&am=${amount}&cu=INR`;
  };

  const openUpiApp = (bill: MyBill) => {
    const upiLink = generateUpiLink(bill);
    window.location.href = upiLink;
    setPaymentStep("confirm");
  };

  const copyUpiId = (upiId: string) => {
    navigator.clipboard.writeText(upiId);
    toastT.success("UPI ID copied!");
  };

  const submitUtrConfirmation = async () => {
    if (!selectedBill || !utrNumber.trim()) {
      toastT.error("Please enter the UTR/Transaction number");
      return;
    }
    setSubmittingUtr(true);
    try {
      const res = await fetch(`/api/my-bills/${selectedBill.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utrNumber: utrNumber.trim(), paidVia: "upi" }),
      });
      if (res.ok) {
        toastT.success("Payment successful. Receipt generated.");
        setShowPaymentModal(false);
        fetchBills();
      } else {
        const data = await res.json();
        toastT.error(data.error || "Failed to submit");
      }
    } catch {
      toastT.error("Network error");
    } finally {
      setSubmittingUtr(false);
      setPayingBillId(null);
    }
  };

  if (loading) {
    return (
      <PageState
        variant="loading"
        title={t("Loading bills")}
        description={t("Fetching your maintenance, rent, and staff payment dues.")}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-4 sm:px-6 lg:px-0 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/5">
          <Wallet className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight leading-none sm:leading-normal">{t("My Bills & Payments")}</h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 font-medium">{t("View history & pay via UPI — zero charges")}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-border/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-[9px] sm:text-[10px] font-bold text-text-tertiary tracking-[0.1em] uppercase mb-2">{t("PENDING DUES")}</p>
          <p className="text-2xl sm:text-3xl font-bold text-danger">{formatCurrency(stats.totalPending)}</p>
          {stats.totalPending > 0 && <p className="text-[10px] text-danger mt-2 font-medium">{t("⚠ Clear dues to avoid late fees")}</p>}
        </div>
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-border/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-[9px] sm:text-[10px] font-bold text-text-tertiary tracking-[0.1em] uppercase mb-2">{t("TOTAL PAID")}</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{formatCurrency(stats.totalPaid)}</p>
          <p className="text-[10px] text-emerald-600 mt-2 font-medium">{t("✓ Thank you for timely payments")}</p>
        </div>
      </div>

      {/* Bills List */}
      {bills.length === 0 ? (
        <div className="card text-center py-24 bg-surface/30 border-dashed border-2">
          <Receipt className="w-10 h-10 text-text-tertiary mx-auto mb-4 opacity-20" />
          <p className="text-text-primary font-bold">{t("No bills generated yet")}</p>
          <p className="text-xs text-text-secondary mt-1">{t("Bills appear here once generated by your society admin")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const total = bill.totalAmount || bill.amount + bill.lateFee + bill.gstAmount;
            const isOverdue = new Date(bill.dueDate) < new Date() && bill.status === "pending";
            const invoiceTitle = bill.description || t("Society Dues");
            const billType = (bill.billType || "maintenance").replace("_", " ");
            const billingCycle = (bill.billingCycle || "monthly").replace("_", " ");
            return (
              <div key={bill.id} className={`bg-white rounded-[1.25rem] border p-5 sm:p-6 transition-all hover:shadow-md ${isOverdue ? "border-l-4 border-l-red-400" : bill.status === "paid" ? "border-l-4 border-l-emerald-400" : "border-border/60"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${bill.status === "paid" ? "bg-emerald-500/5 text-emerald-600" : isOverdue ? "bg-red-500/5 text-red-600" : "bg-primary/5 text-primary"}`}>
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-text-primary">{invoiceTitle}</h4>
                        <StatusBadge status={bill.status} />
                        {isOverdue && (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {t("OVERDUE")}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-1">
                        {t("Society invoice · Payable to {society} · {billType} · {billingCycle} · {period}")
                          .replace("{society}", bill.society?.name || t("society"))
                          .replace("{billType}", billType)
                          .replace("{billingCycle}", billingCycle)
                          .replace("{period}", bill.period)}
                      </p>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="text-xs text-text-secondary">{t("Base:")} {formatCurrency(bill.amount)}</span>
                        {bill.lateFee > 0 && <span className="text-xs text-danger font-medium">+ {t("Late:")} {formatCurrency(bill.lateFee)}</span>}
                        {bill.gstAmount > 0 && <span className="text-xs text-text-secondary">+ {t("GST:")} {formatCurrency(bill.gstAmount)}</span>}
                        <span className="text-xs text-text-tertiary">{t("Due:")} {new Date(bill.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </div>
                      {bill.paidAt && (
                        <p className="text-[10px] text-emerald-600 mt-1">
                          {t("Paid {amount} via {method} on {date}")
                            .replace("{amount}", formatCurrency(bill.paidAmount || total))
                            .replace("{method}", bill.paidVia?.toUpperCase() || "")
                            .replace("{date}", new Date(bill.paidAt).toLocaleDateString("en-IN"))}
                          {bill.receiptNumber && ` · ${t("Receipt")} #${bill.receiptNumber}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="text-lg sm:text-xl font-bold text-text-primary">{formatCurrency(total)}</p>
                      <p className="text-[10px] text-text-secondary">{t("Society dues")}</p>
                    </div>
                    {(bill.status === "pending" || bill.status === "partial") ? (
                      <button
                        onClick={() => handlePayClick(bill)}
                        disabled={payingBillId === bill.id}
                        className="btn btn-primary !rounded-xl !py-2.5 !px-5 text-xs font-bold flex items-center gap-2 shadow-md shadow-primary/10"
                      >
                        <IndianRupee className="w-3.5 h-3.5" /> {t("Pay Now")}
                      </button>
                    ) : bill.receiptNumber ? (
                      <Link href={`/receipts/${bill.id}`} className="btn btn-secondary !rounded-xl !py-2.5 !px-4 text-xs font-bold flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5" /> {t("Receipt")}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(ownerRentals.length > 0 || tenantRentInvoices.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-text-primary">{t("Private Rent")}</h2>
              <p className="text-xs text-text-secondary">
                {t("Owner-to-tenant rent tracking. This is private money and is not counted in society finance.")}
              </p>
            </div>
          </div>

          {tenantRentInvoices.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-text-primary">{t("Rent Payable")}</h3>
                  <p className="text-xs text-text-secondary mt-1">{t("Pay this directly to your linked owner.")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-text-tertiary">{t("Pending Rent")}</p>
                  <p className="text-lg font-black text-danger">{formatCurrency(rentStats.rentPending)}</p>
                </div>
              </div>
              <div className="space-y-3">
                {tenantRentInvoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-2xl border border-border p-4 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-text-primary">{invoice.period}</p>
                          <StatusBadge status={invoice.status} />
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          {t("Private rent · Payable to owner {owner}")
                            .replace("{owner}", invoice.owner?.name || t("Owner"))}
                          {invoice.owner?.phone ? ` · ${invoice.owner.phone}` : ""}
                        </p>
                        <p className="text-[10px] text-text-tertiary mt-1">
                          Flat {invoice.flat.flatNumber} · Period {invoice.period} · Due {new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {invoice.receiptNumber ? ` · Receipt #${invoice.receiptNumber}` : ""}
                        </p>
                      </div>
                      <div className="text-left sm:text-right flex flex-col sm:items-end gap-2">
                        <p className="text-xl font-black text-text-primary">{formatCurrency(invoice.amount)}</p>
                        <p className="text-[10px] text-text-secondary">
                          {invoice.status === "paid" && invoice.paidAt
                            ? t("Paid on {date}").replace("{date}", new Date(invoice.paidAt).toLocaleDateString("en-IN"))
                            : t("Private rent, not society dues")}
                        </p>
                        {invoice.status === "pending" ? (
                          <button
                            onClick={() => payPrivateRent(invoice.id)}
                            disabled={savingRent}
                            className="btn btn-primary btn-sm !rounded-xl"
                          >
                            <IndianRupee className="w-3.5 h-3.5" /> {t("Pay Now")}
                          </button>
                        ) : invoice.receiptNumber ? (
                          <span className="text-[10px] font-bold text-success">{t("Receipt")} #{invoice.receiptNumber}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ownerRentals.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-text-primary">{t("Owner Rent Collection")}</h3>
                  <p className="text-xs text-text-secondary mt-1">{t("Raise rent invoices only for tenants linked to your owned units.")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-text-tertiary">{t("To Collect")}</p>
                    <p className="text-lg font-black text-amber-700">{formatCurrency(rentStats.ownerPending)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-text-tertiary">{t("Received")}</p>
                    <p className="text-lg font-black text-success">{formatCurrency(rentStats.ownerReceived)}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="rounded-2xl border border-warning/20 bg-warning-bg/40 p-4">
                  <p className="text-[10px] font-bold uppercase text-warning-text">{t("Pending Rent")}</p>
                  <p className="text-2xl font-black text-warning-text mt-1">{formatCurrency(rentStats.ownerPending)}</p>
                  <p className="text-xs text-text-secondary mt-1">{t("Invoices waiting for tenant payment.")}</p>
                </div>
                <div className="rounded-2xl border border-success/20 bg-success-bg/40 p-4">
                  <p className="text-[10px] font-bold uppercase text-success">{t("Received Rent")}</p>
                  <p className="text-2xl font-black text-success mt-1">{formatCurrency(rentStats.ownerReceived)}</p>
                  <p className="text-xs text-text-secondary mt-1">{t("Private rent payments recorded from tenants.")}</p>
                </div>
              </div>
              <div className="space-y-3">
                {ownerRentals.map((rental) => (
                  <div key={rental.tenantId} className="rounded-2xl border border-border p-4 bg-white">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                            <UserRound className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-text-primary">{rental.tenantName}</p>
                            <p className="text-xs text-text-secondary">
                              {t("Flat {flat} · {phone} · Monthly rent {rent}")
                                .replace("{flat}", rental.flatNumber)
                                .replace("{phone}", rental.tenantPhone)
                                .replace("{rent}", formatCurrency(rental.monthlyRent))}
                            </p>
                          </div>
                        </div>
                        {rental.invoices.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {rental.invoices.slice(0, 3).map((invoice) => (
                              <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-surface border border-border px-3 py-2">
                                <div>
                                  <p className="text-xs font-bold text-text-primary">
                                    {invoice.period} · {formatCurrency(invoice.amount)}
                                  </p>
                                  <p className="text-[10px] text-text-secondary">
                                    Due {new Date(invoice.dueDate).toLocaleDateString("en-IN")} {invoice.receiptNumber ? `· ${invoice.receiptNumber}` : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={invoice.status} />
                                  {invoice.status === "pending" && (
                                    <button
                                      onClick={() => markRentPaid(invoice.id)}
                                      disabled={savingRent}
                                      className="btn btn-secondary btn-sm !text-[10px]"
                                    >
                                      {t("Mark Paid")}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => openRentModal(rental)} className="btn btn-primary btn-sm shrink-0">
                        {t("Raise Rent Invoice")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(linkedStaff.length > 0 || staffPayments.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-700 flex items-center justify-center">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-text-primary">{t("Staff Payments")}</h2>
              <p className="text-xs text-text-secondary">
                {t("Private payments from your flat to linked daily-help staff. This is not society payroll or society expense.")}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl border border-border bg-surface/50 p-4">
                <p className="text-[10px] font-bold uppercase text-text-tertiary">{t("Linked Staff")}</p>
                <p className="text-2xl font-black text-text-primary mt-1">{staffStats.linkedStaff}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase text-amber-700">{t("Pending")}</p>
                <p className="text-2xl font-black text-amber-700 mt-1">{formatCurrency(staffStats.pending)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[10px] font-bold uppercase text-emerald-700">{t("Paid")}</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(staffStats.paid)}</p>
              </div>
            </div>

            {linkedStaff.length > 0 ? (
              <div className="rounded-2xl border border-border p-4 mb-4">
                <p className="text-xs font-black text-text-primary mb-3">{t("Add Staff Payment")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <select
                    className="select !rounded-xl"
                    value={staffForm.staffId}
                    onChange={(e) => {
                      const staff = linkedStaff.find((item) => item.id === e.target.value);
                      setStaffForm({
                        ...staffForm,
                        staffId: e.target.value,
                        amount: staff?.agreedMonthlyPay ? String(staff.agreedMonthlyPay) : staffForm.amount,
                      });
                    }}
                  >
                    <option value="">{t("Select staff")}</option>
                    {linkedStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} · {staff.category}{staff.agreedMonthlyPay ? ` · ${formatCurrency(staff.agreedMonthlyPay)}/mo` : ""}
                      </option>
                    ))}
                  </select>
                  <input type="month" className="input !rounded-xl" value={staffForm.month} onChange={(e) => setStaffForm({ ...staffForm, month: e.target.value })} />
                  <input type="number" min="1" className="input !rounded-xl" placeholder={t("Amount")} value={staffForm.amount} onChange={(e) => setStaffForm({ ...staffForm, amount: e.target.value })} />
                  <button onClick={createStaffPayment} disabled={savingStaffPayment} className="btn btn-primary !rounded-xl">
                    {t("Add")}
                  </button>
                </div>
                <input className="input !rounded-xl mt-3" placeholder={t("Note optional, e.g. May maid salary")} value={staffForm.note} onChange={(e) => setStaffForm({ ...staffForm, note: e.target.value })} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center mb-4">
                <p className="text-sm font-bold text-text-primary">{t("No staff linked to your flat yet")}</p>
                <p className="text-xs text-text-secondary mt-1">{t("Ask the committee to link your maid, cook, driver, or other staff from Staff & Daily Help.")}</p>
              </div>
            )}

            <div className="space-y-2">
              {staffPayments.length === 0 ? (
                <p className="text-xs text-text-secondary py-2">{t("No staff payment records yet.")}</p>
              ) : staffPayments.map((payment) => (
                <div key={payment.id} className="rounded-2xl border border-border bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-text-primary">{payment.staff.name}</p>
                      <StatusBadge status={payment.status} />
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {payment.staff.category} · {payment.staff.phone} · {payment.month}
                    </p>
                    {payment.paidOn && (
                      <p className="text-[10px] text-emerald-700 mt-1">{t("Paid on {date} via {method}").replace("{date}", new Date(payment.paidOn).toLocaleDateString("en-IN")).replace("{method}", (payment.paidVia || "cash").toUpperCase())}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-black text-text-primary">{formatCurrency(payment.amount)}</p>
                    {payment.status === "pending" && (
                      <button onClick={() => markStaffPaymentPaid(payment.id)} disabled={savingStaffPayment} className="btn btn-secondary btn-sm">
                        {t("Mark Paid")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UPI Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white w-full max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-primary-light p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-medium">{selectedBill.description || t("Society Dues")} · {selectedBill.period}</p>
                    <p className="text-2xl font-bold">{formatCurrency(selectedBill.totalAmount || selectedBill.amount + selectedBill.lateFee + selectedBill.gstAmount)}</p>
                  </div>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/70 text-xs mt-2">{t("Payable to {society} · Flat {flat}").replace("{society}", selectedBill.society?.name || t("society")).replace("{flat}", selectedBill.flat.flatNumber)}</p>
            </div>

            <div className="p-6">
              {paymentStep === "choose" && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-4">{t("Choose Payment Method")}</p>

                  {/* UPI - Primary option */}
                  <button
                    onClick={() => {
                      if (selectedBill.society?.upiId) {
                        openUpiApp(selectedBill);
                      } else {
                        setPaymentStep("upi");
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl hover:border-primary/40 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Smartphone className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-text-primary">{t("Pay via UPI")}</p>
                        <p className="text-[10px] text-emerald-600 font-medium">{t("₹0 transaction charges")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t("RECOMMENDED")}</span>
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </div>
                  </button>

                  {/* Manual UPI */}
                  <button
                    onClick={() => setPaymentStep("upi")}
                    className="w-full flex items-center justify-between p-4 border border-border/60 rounded-2xl hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center">
                        <Copy className="w-5 h-5 text-text-secondary" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-text-primary">{t("Manual Transfer")}</p>
                        <p className="text-[10px] text-text-tertiary">{t("Copy UPI ID & pay from any app")}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-text-tertiary group-hover:text-primary" />
                  </button>
                </div>
              )}

              {paymentStep === "upi" && (
                <div className="space-y-5">
                  <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider">{t("Society Payment Details")}</p>

                  {/* UPI ID */}
                  <div className="bg-surface/50 rounded-xl p-4 border border-border/40">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">{t("UPI ID")}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-mono font-bold text-primary">{selectedBill.society?.upiId || t("Not configured")}</p>
                      {selectedBill.society?.upiId && (
                        <button onClick={() => copyUpiId(selectedBill.society.upiId)} className="btn btn-secondary !rounded-xl !py-1.5 !px-3 text-[10px] font-bold flex items-center gap-1">
                          <Copy className="w-3 h-3" /> {t("Copy")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="bg-surface/50 rounded-xl p-4 border border-border/40">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">{t("EXACT AMOUNT")}</p>
                    <p className="text-2xl font-bold text-text-primary">{formatCurrency(selectedBill.totalAmount || selectedBill.amount + selectedBill.lateFee + selectedBill.gstAmount)}</p>
                    <p className="text-[10px] text-text-tertiary mt-1">Ref: MAINT-{selectedBill.period}-{selectedBill.flat.flatNumber}</p>
                  </div>

                  {/* Open UPI app button */}
                  {selectedBill.society?.upiId && (
                    <button
                      onClick={() => openUpiApp(selectedBill)}
                      className="w-full btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                    >
                      <Smartphone className="w-4 h-4" /> {t("Open UPI App & Pay")}
                    </button>
                  )}

                  <button onClick={() => setPaymentStep("confirm")} className="w-full text-center text-xs font-bold text-primary hover:underline py-2">
                    {t("I've already paid → Enter UTR")}
                  </button>
                </div>
              )}

              {paymentStep === "confirm" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{t("Confirm Your Payment")}</p>
                      <p className="text-xs text-emerald-600 mt-1">{t("Enter the UTR/Transaction ID from your payment app to confirm")}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary ml-1">{t("UTR / Transaction Number *")}</label>
                    <input
                      className="input !rounded-xl !bg-surface font-mono font-bold text-sm px-4 py-3.5 tracking-wider"
                      placeholder={t("e.g. 412345678901")}
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      autoFocus
                    />
                    <p className="text-[10px] text-text-tertiary ml-1">{t("Find this in your UPI app → Transaction History → Details")}</p>
                  </div>

                  <button
                    onClick={submitUtrConfirmation}
                    disabled={submittingUtr || !utrNumber.trim()}
                    className="w-full btn btn-primary !rounded-xl py-4 font-bold text-sm shadow-xl shadow-primary/20 disabled:opacity-50"
                  >
                    {submittingUtr ? t("Submitting...") : t("Confirm Payment")}
                  </button>

                  <button onClick={() => setPaymentStep("upi")} className="w-full text-center text-xs text-text-secondary hover:text-primary py-1">
                    {t("← Back to payment details")}
                  </button>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-center gap-2 text-[9px] text-text-tertiary">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {t("Direct bank transfer · Zero platform fees · Verified by admin")}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRental && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center" onClick={() => setSelectedRental(null)}>
          <div className="bg-white w-full max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{t("Private Rent Invoice")}</p>
                  <h3 className="text-lg font-black text-text-primary mt-1">{selectedRental.tenantName}</h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {t("Flat {flat} · Default rent {rent}")
                      .replace("{flat}", selectedRental.flatNumber)
                      .replace("{rent}", formatCurrency(selectedRental.monthlyRent))}
                  </p>
                </div>
                <button onClick={() => setSelectedRental(null)} className="p-2 rounded-xl hover:bg-surface text-text-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-800">
                  {t("This rent is private owner-to-tenant money. It will not appear in society reports, funds, or Billing & Ledger.")}
                </p>
              </div>
              <div>
                <label className="label">{t("Billing Period *")}</label>
                <input
                  type="month"
                  className="input"
                  value={rentForm.period}
                  onChange={(e) => setRentForm({ ...rentForm, period: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("Rent Amount *")}</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={rentForm.amount}
                  onChange={(e) => setRentForm({ ...rentForm, amount: e.target.value })}
                />
                <p className="text-[10px] text-text-secondary mt-1">{t("Prefilled from Tenant Management monthly rent. Edit only if rent changed for this month.")}</p>
              </div>
              <div>
                <label className="label">{t("Due Date *")}</label>
                <input
                  type="date"
                  className="input"
                  value={rentForm.dueDate}
                  onChange={(e) => setRentForm({ ...rentForm, dueDate: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setSelectedRental(null)} className="btn btn-secondary">{t("Cancel")}</button>
                <button onClick={createRentInvoice} disabled={savingRent} className="btn btn-primary">
                  {savingRent ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : <Receipt className="w-4 h-4" />}
                  {t("Raise Invoice")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
