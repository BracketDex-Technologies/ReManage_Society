"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { ChevronLeft, ChevronRight, Search, FileText, Bell, Zap, RefreshCcw, Save, Settings2, Trash2, MessageCircle, Link2, Copy, Send, Gauge } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { BillWithFlat, BillingSummary } from "@/types";
import Link from "next/link";
import { useLiveQuery } from "@/lib/use-live-data";
import { LIVE_FAST_INTERVAL_MS } from "@/lib/live-refresh";
import { useAppDialog } from "@/components/ui/AppDialogProvider";

export default function MaintenancePage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const { confirm } = useAppDialog();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generating, setGenerating] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [applyingLateFees, setApplyingLateFees] = useState(false);
  const [markPaidBill, setMarkPaidBill] = useState<BillWithFlat | null>(null);
  const [editInvoiceBill, setEditInvoiceBill] = useState<BillWithFlat | null>(null);
  const [invoiceForm, setInvoiceForm] = useState(() => {
    const now = new Date();
    return {
      amount: "",
      billType: "maintenance",
      billingCycle: "monthly",
      description: "Monthly Maintenance",
      dueDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString().split("T")[0],
      flatIds: [] as string[],
    };
  });
  const [billingConfig, setBillingConfig] = useState({
    maintenanceAmt: "",
    dueDayOfMonth: "10",
    lateFee: "",
    duesEnforcementEnabled: true,
    duesEnforcementDays: "60",
  });
  const [payForm, setPayForm] = useState({
    paidAmount: "",
    paidVia: "cash",
    paidAt: new Date().toISOString().split("T")[0],
    receiptNote: "",
  });
  const [editInvoiceForm, setEditInvoiceForm] = useState({
    amount: "",
    dueDate: "",
  });
  const [payLinkModal, setPayLinkModal] = useState<{
    flatNumber: string;
    payUrl: string;
    whatsAppUrl: string;
    message: string;
    payerPhone: string | null;
  } | null>(null);
  const [creatingPayLink, setCreatingPayLink] = useState<string | null>(null);
  const [sendingBulkReminders, setSendingBulkReminders] = useState(false);

  // Optimized query hook with live polling
  const { 
    data, 
    loading, 
    refetch,
    isStale 
  } = useLiveQuery<{ bills: BillWithFlat[], summary: BillingSummary }>(
    "/api/maintenance/bills",
    { period, status: statusFilter, search },
    { interval: LIVE_FAST_INTERVAL_MS }
  );

  const { data: invoiceData } = useLiveQuery<{
    availableFlats: Array<{
      id: string;
      flatNumber: string;
      ownerName: string;
      role: string;
      linkedOwnerName: string | null;
      linkedOwnerPhone: string | null;
      linkedOwnerEmail: string | null;
      tenantName: string | null;
      tenantPhone: string | null;
      privateMonthlyRent: number | null;
      billingResponsibility: string;
      payerName: string;
      payerRole: string;
      payerPhone: string | null;
      payerEmail: string | null;
    }>;
    summary: BillingSummary;
    defaultInvoiceAmount: number;
    defaultDueDayOfMonth: number;
  }>(
    "/api/maintenance/bills",
    { period, status: "all", search: "", billType: invoiceForm.billType, billingCycle: invoiceForm.billingCycle },
    { interval: LIVE_FAST_INTERVAL_MS }
  );

  const bills = data?.bills || [];
  const summary = data?.summary || null;
  const availableFlats = invoiceData?.availableFlats || [];

  useEffect(() => {
    if (!showInvoiceModal) return;
    const defaultAmount = invoiceData?.defaultInvoiceAmount || 0;
    if (defaultAmount > 0 && !invoiceForm.amount) {
      setInvoiceForm((current) => ({ ...current, amount: String(defaultAmount) }));
    }
  }, [invoiceData?.defaultInvoiceAmount, invoiceForm.amount, showInvoiceModal]);

  useEffect(() => {
    if (!showInvoiceModal) return;
    const [year, month] = period.split("-").map(Number);
    const day = Number(invoiceData?.defaultDueDayOfMonth || billingConfig.dueDayOfMonth || 10);
    if (!year || !month || !day) return;
    setInvoiceForm((current) => ({
      ...current,
      dueDate: new Date(year, month - 1, day).toISOString().split("T")[0],
    }));
  }, [billingConfig.dueDayOfMonth, invoiceData?.defaultDueDayOfMonth, period, showInvoiceModal]);

  useEffect(() => {
    fetch("/api/maintenance/settings")
      .then((res) => res.json())
      .then((data) => {
        if (!data.society) return;
        setBillingConfig({
          maintenanceAmt: data.society.maintenanceAmt?.toString() || "",
          dueDayOfMonth: data.society.dueDayOfMonth?.toString() || "10",
          lateFee: data.society.lateFee?.toString() || "",
          duesEnforcementEnabled: data.society.duesEnforcementEnabled !== false,
          duesEnforcementDays: String(data.society.duesEnforcementDays ?? 60),
        });
      })
      .catch(() => {});
  }, []);

  const navigateMonth = (dir: number) => {
    const [y, m] = period.split("-").map(Number);
    const date = new Date(y, m - 1 + dir);
    setPeriod(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const periodLabel = (() => {
    const [y, m] = period.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  })();

  const generateBills = async () => {
    const amount = parseFloat(invoiceForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toastT.error("Enter a valid invoice amount");
      return;
    }
    if (!invoiceForm.flatIds.length) {
      toastT.error("Select at least one billable unit");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/maintenance/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          amount,
          dueDate: invoiceForm.dueDate,
          flatIds: invoiceForm.flatIds,
          billType: invoiceForm.billType,
          billingCycle: invoiceForm.billingCycle,
          description: invoiceForm.description,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(t("{count} invoices raised for {period}")
          .replace("{count}", String(data.generated))
          .replace("{period}", periodLabel));
        setShowInvoiceModal(false);
        setInvoiceForm((current) => ({ ...current, flatIds: [] }));
        refetch();
      } else {
        toastT.error(data.error || "Failed to generate bills");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const saveBillingConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/maintenance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billingConfig),
      });
      if (!res.ok) {
        const data = await res.json();
        toastT.error(data.error || "Failed to save billing setup");
        return;
      }
      toastT.success("Billing setup saved");
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSavingConfig(false);
    }
  };

  const applyLateFees = async () => {
    setApplyingLateFees(true);
    try {
      const res = await fetch("/api/maintenance/late-fees", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to apply late fees");
        return;
      }
      toastT.success(data.message || t("Late fees applied"));
      refetch();
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setApplyingLateFees(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidBill) return;
    const paidAmount = parseFloat(payForm.paidAmount) || 0;
    const totalDue = markPaidBill.totalAmount || markPaidBill.amount + markPaidBill.lateFee + (markPaidBill.gstAmount || 0);
    if (totalDue <= 0) {
      toastT.error("Edit invoice amount before recording payment");
      return;
    }
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      toastT.error("Enter payment amount greater than zero");
      return;
    }
    const isPartial = paidAmount < totalDue;
    const remaining = totalDue - paidAmount;
    
    let note = payForm.receiptNote;
    if (isPartial && remaining > 0) {
      const remainingText = `₹${remaining} remaining`;
      if (!note.includes(remainingText)) {
        note = note ? `${note} (${remainingText})` : remainingText;
      }
    }

    try {
      const res = await fetch(`/api/maintenance/bills/${markPaidBill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: isPartial ? "partial" : "paid",
          paidAmount: paidAmount,
          paidVia: payForm.paidVia,
          paidAt: payForm.paidAt,
          receiptNote: note,
        }),
      });
      if (res.ok) {
        toastT.success(t("Flat {flat} updated").replace("{flat}", markPaidBill.flat.flatNumber));
        refetch();
      } else {
        const data = await res.json();
        toastT.error(data.error || "Failed to update");
      }
    } catch {
      toastT.error("Something went wrong");
    }
    setMarkPaidBill(null);
  };

  const openEditInvoice = (bill: BillWithFlat) => {
    setEditInvoiceBill(bill);
    setEditInvoiceForm({
      amount: String(bill.totalAmount || bill.amount + bill.lateFee + (bill.gstAmount || 0) || ""),
      dueDate: new Date(bill.dueDate).toISOString().split("T")[0],
    });
  };

  const saveInvoiceEdit = async () => {
    if (!editInvoiceBill) return;
    const amount = parseFloat(editInvoiceForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toastT.error("Enter invoice amount greater than zero");
      return;
    }

    try {
      const res = await fetch(`/api/maintenance/bills/${editInvoiceBill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_invoice",
          amount,
          dueDate: editInvoiceForm.dueDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toastT.success(t("Invoice updated for Flat {flat}").replace("{flat}", editInvoiceBill.flat.flatNumber));
        setEditInvoiceBill(null);
        refetch();
      } else {
        toastT.error(data.error || "Failed to update invoice");
      }
    } catch {
      toastT.error("Something went wrong");
    }
  };

  const deleteInvoice = async (bill: BillWithFlat) => {
    if (bill.status !== "pending") return;
    const total = bill.totalAmount || bill.amount + bill.lateFee + (bill.gstAmount || 0);
    const confirmed = await confirm({
      title: t("Delete Invoice"),
      message: t("Delete {description} invoice for Flat {flat} ({amount})? This is allowed only before payment.")
        .replace("{description}", bill.description || t("society dues"))
        .replace("{flat}", bill.flat.flatNumber)
        .replace("{amount}", formatCurrency(total)),
      confirmLabel: t("Delete Invoice"),
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/maintenance/bills/${bill.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toastT.success("Invoice deleted");
        refetch();
      } else {
        toastT.error(data.error || "Failed to delete invoice");
      }
    } catch {
      toastT.error("Something went wrong");
    }
  };

  const openMarkPaid = (bill: BillWithFlat) => {
    setMarkPaidBill(bill);
    
    // If bill is already paid/partial, we are "editing", so show current paid amount
    // If pending, we show the total bill amount (initial collection)
    const displayAmount = (bill.status !== "pending" && bill.paidAmount !== null)
      ? bill.paidAmount 
      : (bill.totalAmount || bill.amount + bill.lateFee + (bill.gstAmount || 0));

    setPayForm({
      paidAmount: displayAmount.toString(),
      paidVia: bill.paidVia || "cash",
      paidAt: bill.paidAt ? new Date(bill.paidAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      receiptNote: bill.receiptNote || "",
    });
  };

  const createPayLink = async (bill: BillWithFlat, sentVia: "copy" | "whatsapp" = "copy") => {
    setCreatingPayLink(bill.id);
    try {
      const res = await fetch(`/api/maintenance/bills/${bill.id}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentVia,
          payerPhone: bill.billingRecipient?.payerPhone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to create payment link");
        return;
      }

      if (sentVia === "whatsapp") {
        window.open(data.whatsAppUrl, "_blank", "noopener,noreferrer");
        toastT.success(t("WhatsApp opened for Flat {flat}").replace("{flat}", bill.flat.flatNumber));
      } else {
        setPayLinkModal({
          flatNumber: data.flatNumber,
          payUrl: data.payUrl,
          whatsAppUrl: data.whatsAppUrl,
          message: data.message,
          payerPhone: data.payerPhone,
        });
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setCreatingPayLink(null);
    }
  };

  const sendBulkPaymentLinks = async () => {
    setSendingBulkReminders(true);
    try {
      const res = await fetch("/api/maintenance/payment-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to prepare payment links");
        return;
      }
      toastT.success(t("{count} pay links ready — open WhatsApp for each defaulter").replace("{count}", String(data.count)));
      if (data.reminders?.length > 0) {
        setPayLinkModal({
          flatNumber: `${data.count} flats`,
          payUrl: data.reminders[0].payUrl,
          whatsAppUrl: data.reminders[0].whatsAppUrl,
          message: data.message || `Prepared ${data.count} payment reminders for ${periodLabel}`,
          payerPhone: null,
        });
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSendingBulkReminders(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/maintenance/bills?period=${period}`);
      const data = await res.json();
      if (!data.bills || data.bills.length === 0) return toastT.error("No bills to export");
      
      const headers = ["Flat No.", "Billed To", "Payer Role", "Amount", "Paid Amount", "Status", "Due Date", "Paid Date", "Payment Method", "Receipt No", "Note"];
      const csvContent = [headers.join(","), ...data.bills.map((b: BillWithFlat) => [b.flat.flatNumber, b.billingRecipient?.payerName || b.flat.ownerName, b.billingRecipient?.payerRole || "Resident", b.amount, b.paidAmount || 0, b.status, new Date(b.dueDate).toISOString().split('T')[0], b.paidAt ? new Date(b.paidAt).toISOString().split('T')[0] : "", b.paidVia || "", b.receiptNumber || "", b.receiptNote || ""].map(v => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `maintenance_bills_${period}.csv`);
      link.click();
      toastT.success("Export successful");
    } catch { toastT.error("Failed to export"); }
  };

  return (
    <div className={isStale ? "opacity-90" : "transition-opacity"}>
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title flex items-center gap-2">
            {t("Maintenance")}
            {loading && !data && <div className="spinner !w-4 !h-4" />}
            {isStale && <RefreshCcw className="w-4 h-4 text-primary animate-spin" />}
          </h1>
          <div className="flex items-center gap-1 bg-white border border-border rounded-lg px-1">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-surface rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium px-2 min-w-[140px] text-center">{periodLabel}</span>
            <button onClick={() => navigateMonth(1)} className="p-1.5 hover:bg-surface rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Link href="/maintenance/meter-readings" className="btn btn-secondary btn-sm flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            {t("Import meter readings")}
          </Link>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold text-text-primary">{t("Billing Setup")}</h2>
              <p className="text-xs text-text-secondary mt-0.5">{t("Default society dues used when raising monthly invoices.")}</p>
            </div>
          </div>
          <button onClick={saveBillingConfig} disabled={savingConfig} className="btn btn-primary btn-sm">
            {savingConfig ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : <Save className="w-4 h-4" />}
            {t("Save Setup")}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">{t("Monthly Maintenance Default (₹)")}</label>
            <input type="number" className="input" value={billingConfig.maintenanceAmt} onChange={(e) => setBillingConfig({ ...billingConfig, maintenanceAmt: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("Default Due Day")}</label>
            <select className="select" value={billingConfig.dueDayOfMonth} onChange={(e) => setBillingConfig({ ...billingConfig, dueDayOfMonth: e.target.value })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>{t("{day}th of every month").replace("{day}", String(day))}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("Late Fee (₹)")}</label>
            <input type="number" className="input" value={billingConfig.lateFee} onChange={(e) => setBillingConfig({ ...billingConfig, lateFee: e.target.value })} />
          </div>
        </div>
        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-sm font-semibold text-text-primary mb-3">{t("Default Prevention (The Enforcer)")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={billingConfig.duesEnforcementEnabled}
                onChange={(e) => setBillingConfig({ ...billingConfig, duesEnforcementEnabled: e.target.checked })}
              />
              <span>
                <span className="text-sm font-medium text-text-primary block">{t("Block amenity & guest parking for defaulters")}</span>
                <span className="text-xs text-text-secondary">{t("Residents with long-overdue dues cannot book clubhouse or request guest parking.")}</span>
              </span>
            </label>
            <div>
              <label className="label">{t("Overdue threshold (days)")}</label>
              <input
                type="number"
                min={1}
                className="input"
                value={billingConfig.duesEnforcementDays}
                onChange={(e) => setBillingConfig({ ...billingConfig, duesEnforcementDays: e.target.value })}
                disabled={!billingConfig.duesEnforcementEnabled}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={applyLateFees} disabled={applyingLateFees} className="btn btn-secondary btn-sm">
            <Bell className="w-4 h-4" />
            {applyingLateFees ? t("Applying...") : t("Apply Late Fees")}
          </button>
          <p className="text-xs text-text-secondary">{t("Applies once to overdue pending or partial invoices.")}</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="stat-card border-l-4 border-l-success">
            <p className="text-sm font-medium text-text-secondary">{t("Paid ({count})").replace("{count}", String(summary.paid))}</p>
            <p className="text-xl font-bold text-success-text mt-1">{formatCurrency(summary.collectedAmount)}</p>
          </div>
          <div className="stat-card border-l-4 border-l-danger">
            <p className="text-sm font-medium text-text-secondary">{t("Pending ({count})").replace("{count}", String(summary.pending))}</p>
            <p className="text-xl font-bold text-danger-text mt-1">{formatCurrency(summary.pendingAmount)}</p>
          </div>
          <div className="stat-card border-l-4 border-l-primary">
            <p className="text-sm font-medium text-text-secondary">{t("Total Billed")}</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(summary.collectedAmount + summary.pendingAmount)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={exportCsv} className="btn btn-secondary btn-sm"><FileText className="w-4 h-4" /> {t("Export CSV")}</button>
        {summary && summary.total === 0 && (
          <button onClick={() => setShowInvoiceModal(true)} disabled={generating} className="btn btn-primary btn-sm">
            <Zap className="w-4 h-4" /> {t("Raise invoices for {period}").replace("{period}", periodLabel)}
          </button>
        )}
        {summary && summary.total > 0 && (
          <button onClick={() => setShowInvoiceModal(true)} disabled={generating} className="btn btn-primary btn-sm">
            <Zap className="w-4 h-4" /> {t("Raise another invoice")}
          </button>
        )}
        {summary && summary.total > 0 && (
          <button 
            onClick={async () => {
              setGenerating(true);
              try {
                const res = await fetch("/api/system/sync-bills", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  toastT.success(t("{message} ({count} bills added)")
                    .replace("{message}", data.message)
                    .replace("{count}", String(data.newlyCreated)));
                  refetch();
                } else {
                  toastT.error(data.error || "Failed to sync");
                }
              } catch {
                toastT.error("Something went wrong");
              } finally {
                setGenerating(false);
              }
            }} 
            disabled={generating} 
            className="btn btn-secondary btn-sm"
          >
            <RefreshCcw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} /> {t("Sync missing members")}
          </button>
        )}
        {summary && summary.pending > 0 && (
          <>
            <button
              onClick={sendBulkPaymentLinks}
              disabled={sendingBulkReminders}
              className="btn btn-primary btn-sm"
              title={t("Generate one-click pay links for all pending bills")}
            >
              {sendingBulkReminders ? <div className="spinner !w-4 !h-4" /> : <Send className="w-4 h-4" />}
              {t("Pay links ({count})").replace("{count}", String(summary.pending))}
            </button>
            <Link href="/reminders" className="btn btn-secondary btn-sm"><Bell className="w-4 h-4" /> {t("Send reminders")}</Link>
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input type="text" className="input pl-9" placeholder={t("Search flat or owner...")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-white border border-border rounded-lg p-0.5">
          {["all", "paid", "partial", "pending"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${statusFilter === s ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"}`}>{t(s.charAt(0).toUpperCase() + s.slice(1))}</button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : bills.length === 0 ? (
        <div className="card text-center py-12 text-text-secondary">{t("No records found.")}</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Flat No.")}</th>
                <th>{t("Billed To")}</th>
                <th>{t("Total Amt")}</th>
                <th className="hidden md:table-cell">{t("Paid Amt")}</th>
                <th>{t("Status")}</th>
                <th className="hidden sm:table-cell">{t("Due Date")}</th>
                <th className="text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td className="font-medium">{bill.flat.flatNumber}</td>
                  <td className="min-w-[180px]">
                    <p className="font-semibold truncate">{bill.billingRecipient?.payerName || bill.flat.ownerName || t("Linked resident")}</p>
                    <p className="text-[10px] text-text-secondary">{bill.billingRecipient?.payerRole || t("Resident")}</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      {bill.description || t("Society Dues")} · {(bill.billType || "maintenance").replace("_", " ")} · {(bill.billingCycle || "monthly").replace("_", " ")}
                    </p>
                  </td>
                  <td className="font-medium">{formatCurrency(bill.totalAmount || bill.amount + bill.lateFee + (bill.gstAmount || 0))}</td>
                  <td className="hidden md:table-cell text-text-secondary">
                    {bill.paidAmount ? formatCurrency(bill.paidAmount) : "—"}
                  </td>
                  <td><StatusBadge status={bill.status} /></td>
                  <td className="hidden sm:table-cell text-text-secondary">
                    {new Date(bill.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {bill.status === "pending" ? (
                        <>
                          <button
                            onClick={() => createPayLink(bill, "whatsapp")}
                            disabled={creatingPayLink === bill.id}
                            className="btn btn-primary btn-sm !py-1 !px-2 text-xs"
                            title={t("Send WhatsApp pay link")}
                          >
                            {creatingPayLink === bill.id ? <div className="spinner !w-3 !h-3" /> : <MessageCircle className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => createPayLink(bill, "copy")}
                            disabled={creatingPayLink === bill.id}
                            className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                            title={t("Copy pay link")}
                          >
                            <Link2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => openEditInvoice(bill)} className="btn btn-secondary btn-sm !py-1 !px-2 text-xs">{t("Edit Invoice")}</button>
                          <button onClick={() => openMarkPaid(bill)} className="btn btn-secondary btn-sm !py-1 !px-2 text-xs">{t("Record Offline")}</button>
                          <button onClick={() => deleteInvoice(bill)} className="btn btn-secondary btn-sm !py-1 !px-2 text-xs text-danger" title={t("Delete pending invoice")}>
                            <Trash2 className="w-3 h-3" /> {t("Delete")}
                          </button>
                        </>
                      ) : bill.status === "partial" ? (
                        <>
                          <button onClick={() => openMarkPaid(bill)} className="btn btn-secondary btn-sm !py-1 !px-2 text-xs" title={t("Edit Payment")}>{t("Edit")}</button>
                          <Link href={`/receipts/${bill.id}`} className="btn btn-secondary btn-sm !py-1 !px-2 text-xs" title={t("View Receipt")}>
                            <FileText className="w-3 h-3" />
                          </Link>
                        </>
                      ) : (
                        <Link href={`/receipts/${bill.id}`} className="btn btn-secondary btn-sm !py-1 !px-2 text-xs" title={t("View Receipt")}>
                          <FileText className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInvoiceModal && (
        <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <h3 className="text-lg font-semibold">{t("Raise Maintenance Invoices")}</h3>
              <p className="text-sm text-text-secondary mt-1">
                {t("Select active units and the system will bill the owner or tenant based on occupancy billing responsibility for {period}.").replace("{period}", periodLabel)}
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">{t("Billable Units *")}</label>
                  {availableFlats.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setInvoiceForm((current) => ({ ...current, flatIds: availableFlats.map((flat) => flat.id) }))}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {t("Select all available")}
                    </button>
                  )}
                </div>
                {availableFlats.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary">
                    {t("All linked flats already have an invoice for {period}.").replace("{period}", periodLabel)}
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {availableFlats.map((flat) => {
                      const checked = invoiceForm.flatIds.includes(flat.id);
                      return (
                        <label key={flat.id} className="flex items-center gap-3 p-3 hover:bg-surface cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setInvoiceForm((current) => ({
                                ...current,
                                flatIds: e.target.checked
                                  ? [...current.flatIds, flat.id]
                                  : current.flatIds.filter((id) => id !== flat.id),
                              }));
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text-primary">{flat.flatNumber}</p>
                            <p className="text-xs text-text-primary truncate">
                              {t("Bill to {name} ({role})")
                                .replace("{name}", flat.payerName || flat.ownerName)
                                .replace("{role}", flat.payerRole || flat.role)}
                            </p>
                            {flat.tenantName && (
                              <p className="text-[10px] text-text-secondary truncate">
                                {t("Tenant:")} {flat.tenantName}
                                {flat.privateMonthlyRent ? ` · ${t("Private rent")} ${formatCurrency(flat.privateMonthlyRent)}/${t("month")}` : ""}
                              </p>
                            )}
                            {flat.linkedOwnerName && (
                              <p className="text-[10px] text-text-secondary truncate">
                                {t("Owner:")} {flat.linkedOwnerName}
                                {flat.linkedOwnerPhone ? ` · ${flat.linkedOwnerPhone}` : ""}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="label">{t("Invoice Type")}</label>
                    <select
                      className="select"
                      value={invoiceForm.billType}
                      onChange={(e) => {
                        const label = e.target.options[e.target.selectedIndex]?.text || t("Society Dues");
                        const nextCycle = e.target.value === "annual" ? "yearly" : e.target.value === "maintenance" ? "monthly" : invoiceForm.billingCycle;
                        setInvoiceForm({ ...invoiceForm, billType: e.target.value, billingCycle: nextCycle, description: label });
                      }}
                    >
                      <option value="maintenance">{t("Monthly Maintenance")}</option>
                      <option value="annual">{t("Annual Society Charges")}</option>
                      <option value="sinking">{t("Sinking Fund")}</option>
                      <option value="repair">{t("Repair Contribution")}</option>
                      <option value="parking">{t("Parking Charges")}</option>
                      <option value="other">{t("Other Society Dues")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{t("Billing Cycle")}</label>
                    <select className="select" value={invoiceForm.billingCycle} onChange={(e) => setInvoiceForm({ ...invoiceForm, billingCycle: e.target.value })}>
                      <option value="monthly">{t("Monthly")}</option>
                      <option value="yearly">{t("Yearly")}</option>
                      <option value="one_time">{t("One-time")}</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="label">{t("Invoice Title")}</label>
                  <input className="input" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
                </div>
                <label className="label">{t("Invoice Amount *")}</label>
                <input
                  type="number"
                  className="input"
                  autoFocus
                  placeholder={t("e.g. 2500")}
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                />
                <p className="text-xs text-text-secondary mt-1">
                  {t("This is society income/dues. Tenant private rent is shown above only for context and is not billed by the society.")}
                </p>
              </div>
              <div>
                <label className="label">{t("Due Date *")}</label>
                <input
                  type="date"
                  className="input"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-8">
              <button onClick={() => setShowInvoiceModal(false)} className="btn btn-secondary flex-1">{t("Cancel")}</button>
              <button onClick={generateBills} disabled={generating || availableFlats.length === 0} className="btn btn-primary flex-[2]">
                {generating ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : <Zap className="w-4 h-4" />}
                {t("Raise Invoices")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editInvoiceBill && (
        <div className="modal-overlay" onClick={() => setEditInvoiceBill(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <h3 className="text-lg font-semibold">{t("Edit Invoice")}</h3>
              <p className="text-sm text-text-secondary mt-1">
                {t("Flat")} {editInvoiceBill.flat.flatNumber} · {editInvoiceBill.period}
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">{t("Invoice Amount *")}</label>
                <input
                  type="number"
                  className="input"
                  autoFocus
                  value={editInvoiceForm.amount}
                  onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("Due Date *")}</label>
                <input
                  type="date"
                  className="input"
                  value={editInvoiceForm.dueDate}
                  onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-8">
              <button onClick={() => setEditInvoiceBill(null)} className="btn btn-secondary flex-1">{t("Cancel")}</button>
              <button onClick={saveInvoiceEdit} className="btn btn-primary flex-[2]">{t("Save Invoice")}</button>
            </div>
          </div>
        </div>
      )}

      {markPaidBill && (
        <div className="modal-overlay" onClick={() => setMarkPaidBill(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {markPaidBill.status === "pending" ? t("Collect Payment") : t("Update Payment")}
              </h3>
              <p className="text-sm font-bold text-primary">{t("Flat")} {markPaidBill.flat.flatNumber}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="label mb-0">{t("Amount Collected *")}</label>
                  <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    {t("Total Due:")} {formatCurrency(markPaidBill.totalAmount || markPaidBill.amount + markPaidBill.lateFee + (markPaidBill.gstAmount || 0))}
                  </span>
                </div>
                <input 
                  type="number" 
                  className="input" 
                  autoFocus
                  placeholder="₹"
                  value={payForm.paidAmount} 
                  onChange={(e) => setPayForm({ ...payForm, paidAmount: e.target.value })} 
                />
              </div>

              <div>
                <label className="label">{t("Payment Method *")}</label>
                <select className="select" value={payForm.paidVia} onChange={(e) => setPayForm({ ...payForm, paidVia: e.target.value })}>
                  <option value="cash">{t("Cash")}</option>
                  <option value="upi">{t("UPI")}</option>
                  <option value="neft">{t("NEFT / Bank Transfer")}</option>
                  <option value="cheque">{t("Cheque")}</option>
                </select>
              </div>

              <div>
                <label className="label">{t("Payment Date *")}</label>
                <input type="date" className="input" value={payForm.paidAt} onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })} />
              </div>

              <div>
                <label className="label">{t("Receipt Note / Reference")}</label>
                <input className="input" placeholder={t("e.g. UPI Ref Id or Cheque #")} value={payForm.receiptNote} onChange={(e) => setPayForm({ ...payForm, receiptNote: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-8">
              <button 
                onClick={handleMarkPaid} 
                className="btn btn-primary w-full"
              >
                {markPaidBill.status === "pending" ? t("Save Collection") : t("Update Records")}
              </button>
              
              <div className="flex gap-2">
                <button onClick={() => setMarkPaidBill(null)} className="btn btn-secondary flex-1">{t("Cancel")}</button>
                {markPaidBill.status !== "pending" && (
                  <button 
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("Revert Payment"),
                        message: t("Revert this payment? This will mark the invoice as pending again."),
                        confirmLabel: t("Revert Payment"),
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        const res = await fetch(`/api/maintenance/bills/${markPaidBill.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "pending" }),
                        });
                        if (res.ok) {
                          toastT.success("Payment reverted to pending");
                          refetch();
                          setMarkPaidBill(null);
                        }
                      } catch { toastT.error("Failed to revert"); }
                    }} 
                    className="btn btn-danger flex-1"
                  >
                    {t("Reset to Pending")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {payLinkModal && (
        <div className="modal-overlay" onClick={() => setPayLinkModal(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" />
                {t("One-Click Pay Link")}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                {t("Flat")} {payLinkModal.flatNumber} · {t("Residents can pay via UPI without logging in.")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-surface/50 rounded-xl p-4 border border-border/40">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">{t("Payment link")}</p>
                <p className="text-xs font-mono break-all text-primary">{payLinkModal.payUrl}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(payLinkModal.payUrl);
                    toastT.success("Link copied!");
                  }}
                  className="btn btn-secondary btn-sm mt-3"
                >
                  <Copy className="w-3 h-3" /> {t("Copy link")}
                </button>
              </div>

              <div className="bg-surface/50 rounded-xl p-4 border border-border/40">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">{t("WhatsApp message preview")}</p>
                <pre className="text-xs whitespace-pre-wrap text-text-secondary font-sans max-h-40 overflow-y-auto">{payLinkModal.message}</pre>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-8">
              <button onClick={() => setPayLinkModal(null)} className="btn btn-secondary flex-1">{t("Close")}</button>
              <button
                onClick={() => window.open(payLinkModal.whatsAppUrl, "_blank", "noopener,noreferrer")}
                className="btn btn-primary flex-[2] flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> {t("Send on WhatsApp")}
              </button>
            </div>
            {!payLinkModal.payerPhone && (
              <p className="text-[10px] text-text-tertiary mt-3 text-center">
                {t("No phone on file — WhatsApp will open without a pre-filled contact.")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
