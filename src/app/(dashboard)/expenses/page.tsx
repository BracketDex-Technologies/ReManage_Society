"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import {
  Plus,
  Wallet,
  Download,
  RefreshCcw,
  Paperclip,
  ShieldCheck,
  ShieldAlert,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ExpenseType } from "@/types";
import { useLiveData } from "@/lib/use-live-data";
import { EXPENSE_CATEGORY_GROUPS, expenseCategoryLabel } from "@/lib/finance-categories";
import { ModuleSectionTitle } from "@/components/ux/ModulePageKit";
import { currentPeriod, distinctMonthsFromDates } from "@/lib/history-utils";

type ExpensesResponse = {
  expenses: ExpenseType[];
  total: number;
  pendingApprovalCount: number;
  viewerRole: string;
  canApprove: boolean;
};

export default function ExpensesPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expenseMonth, setExpenseMonth] = useState<string>("all");
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "maintenance",
    paidTo: "",
    paidOn: new Date().toISOString().split("T")[0],
    notes: "",
    billProofDataUrl: "",
    billProofFileName: "",
    billProofFileType: "",
  });

  const {
    data,
    loading,
    refetch,
    isStale,
  } = useLiveData<ExpensesResponse>({
    url: "/api/expenses",
    interval: 60_000,
  });

  const expenses = data?.expenses || [];
  const total = data?.total || 0;
  const pendingApprovalCount = data?.pendingApprovalCount || 0;
  const canApprove = data?.canApprove || false;
  const viewerRole = data?.viewerRole || "";

  const approvedExpenses = expenses.filter((e) => e.approvalStatus === "approved");
  const pendingExpenses = expenses.filter((e) => e.approvalStatus === "pending_approval");
  const rejectedExpenses = expenses.filter((e) => e.approvalStatus === "rejected");

  const missingProofCount = approvedExpenses.filter((expense) => !expense.billProofDataUrl).length;
  const unverifiedProofCount = approvedExpenses.filter(
    (expense) => expense.billProofDataUrl && !expense.billProofVerifiedAt,
  ).length;
  const categoryTotals = approvedExpenses.reduce<Record<string, number>>((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const expensePaidMonth = (paidOn: Date | string) => {
    const date = typeof paidOn === "string" ? new Date(paidOn) : paidOn;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const ledgerExpenses = [...approvedExpenses, ...rejectedExpenses];
  const availableMonths = distinctMonthsFromDates(
    ledgerExpenses.map((expense) =>
      typeof expense.paidOn === "string" ? expense.paidOn : expense.paidOn.toISOString(),
    ),
  );
  const thisMonth = currentPeriod();
  const currentMonthLedger = ledgerExpenses.filter((expense) => expensePaidMonth(expense.paidOn) === thisMonth);
  const pastLedger = ledgerExpenses.filter((expense) => expensePaidMonth(expense.paidOn) !== thisMonth);
  const filteredLedger =
    expenseMonth === "all"
      ? ledgerExpenses
      : ledgerExpenses.filter((expense) => expensePaidMonth(expense.paidOn) === expenseMonth);

  const resetForm = () => {
    setForm({
      title: "",
      amount: "",
      category: "maintenance",
      paidTo: "",
      paidOn: new Date().toISOString().split("T")[0],
      notes: "",
      billProofDataUrl: "",
      billProofFileName: "",
      billProofFileType: "",
    });
  };

  const handleProofFile = (file: File | null) => {
    if (!file) {
      setForm((current) => ({ ...current, billProofDataUrl: "", billProofFileName: "", billProofFileType: "" }));
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toastT.error("Upload JPG, PNG, WebP, or PDF bill only");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toastT.error("Bill proof must be under 3 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        billProofDataUrl: String(reader.result || ""),
        billProofFileName: file.name,
        billProofFileType: file.type,
      }));
    };
    reader.onerror = () => toastT.error("Could not read bill proof");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (res.ok) {
        toastT.success(result.message || "Expense saved");
        setShowForm(false);
        resetForm();
        refetch();
      } else {
        toastT.error(result.error || "Failed to add expense");
      }
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const patchExpense = async (expenseId: string, action: string, extra?: Record<string, string>) => {
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId, action, ...extra }),
      });
      const result = await res.json();
      if (!res.ok) {
        toastT.error(result.error || "Could not update expense");
        return;
      }
      toastT.success(result.message || "Updated");
      refetch();
    } catch {
      toastT.error("Something went wrong");
    }
  };

  const verifyProof = (expenseId: string, shouldVerify: boolean) => {
    patchExpense(expenseId, shouldVerify ? "verify_proof" : "unverify_proof");
  };

  const approveExpense = (expenseId: string) => patchExpense(expenseId, "approve_expense");

  const rejectExpense = async () => {
    if (!rejectingId) return;
    await patchExpense(rejectingId, "reject_expense", { reason: rejectReason });
    setRejectingId(null);
    setRejectReason("");
  };

  const categoryColors: Record<string, string> = {
    maintenance: "bg-blue-100 text-blue-700",
    repairs: "bg-orange-100 text-orange-700",
    security_salary: "bg-purple-100 text-purple-700",
    housekeeping_salary: "bg-purple-100 text-purple-700",
    manager_salary: "bg-purple-100 text-purple-700",
    electricity_common_area: "bg-green-100 text-green-700",
    water_bill: "bg-cyan-100 text-cyan-700",
    other: "bg-gray-100 text-gray-700",
  };

  const approvalBadge = (status: string) => {
    if (status === "pending_approval") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-1 text-[10px] font-black text-warning-text">
          <Clock className="h-3 w-3" />
          {t("Pending")}
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-[10px] font-black text-danger">
          <XCircle className="h-3 w-3" />
          {t("Rejected")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-1 text-[10px] font-black text-success">
        <CheckCircle2 className="h-3 w-3" />
        {t("Approved")}
      </span>
    );
  };

  const exportCsv = async () => {
    try {
      const headers = [
        "Date",
        "Description",
        "Amount",
        "Category",
        "Paid To",
        "Approval",
        "Proof",
        "Proof Verified",
        "Notes",
      ];
      const csvContent = [
        headers.join(","),
        ...expenses.map((e: ExpenseType) =>
          [
            new Date(e.paidOn).toISOString().split("T")[0],
            e.title,
            e.amount,
            e.category,
            e.paidTo || "",
            e.approvalStatus,
            e.billProofFileName || "Missing",
            e.billProofVerifiedAt ? `Verified by ${e.billProofVerifiedBy || "finance"}` : "Not verified",
            e.notes || "",
          ]
            .map((v) => `"${v}"`)
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `expenses_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      toastT.success("Export successful");
    } catch {
      toastT.error("Failed to export");
    }
  };

  const submitLabel =
    viewerRole === "treasurer" ? t("Record expense") : t("Submit for approval");

  const renderExpenseRow = (e: ExpenseType, showApprovalActions: boolean) => (
    <tr key={e.id}>
      <td className="text-text-secondary">{formatDate(e.paidOn)}</td>
      <td>
        <p className="font-medium">{e.title}</p>
        {e.notes && <p className="text-[10px] text-text-secondary mt-0.5">{e.notes}</p>}
        {e.submittedBy && e.approvalStatus === "pending_approval" && (
          <p className="text-[10px] text-text-secondary mt-0.5">{t("Submitted by {name}").replace("{name}", e.submittedBy)}</p>
        )}
        {e.rejectionReason && (
          <p className="text-[10px] text-danger mt-0.5">{t("Reason:")} {e.rejectionReason}</p>
        )}
      </td>
      <td className="text-text-secondary">{e.paidTo || "—"}</td>
      <td>
        <span className={`badge text-xs ${categoryColors[e.category] || categoryColors.other}`}>
          {expenseCategoryLabel(e.category)}
        </span>
      </td>
      <td>{approvalBadge(e.approvalStatus)}</td>
      <td>
        {e.billProofDataUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={e.billProofDataUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
              title={e.billProofFileName || t("View bill proof")}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("View")}
            </a>
            {e.approvalStatus === "approved" && (
              e.billProofVerifiedAt ? (
                <button
                  type="button"
                  onClick={() => verifyProof(e.id, false)}
                  className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-1 text-[10px] font-black text-success"
                  title={t("Verified by {name}").replace("{name}", e.billProofVerifiedBy || "finance")}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {t("Verified")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => verifyProof(e.id, true)}
                  className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-1 text-[10px] font-black text-warning-text"
                >
                  <ShieldAlert className="h-3 w-3" />
                  {t("Verify")}
                </button>
              )
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-[10px] font-black text-danger">
            <ShieldAlert className="h-3 w-3" />
            {t("Missing")}
          </span>
        )}
      </td>
      <td className="text-right font-medium">{formatCurrency(e.amount)}</td>
      {showApprovalActions && (
        <td>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => approveExpense(e.id)}
              className="btn btn-primary btn-sm !py-1 !px-2 text-xs"
            >
              {t("Approve")}
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectingId(e.id);
                setRejectReason("");
              }}
              className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
            >
              {t("Reject")}
            </button>
          </div>
        </td>
      )}
    </tr>
  );

  return (
    <div className={isStale ? "opacity-90 transition-opacity" : "transition-opacity"}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title flex items-center gap-2">
              {t("Expenses")}
              {loading && !data && <div className="spinner !w-4 !h-4" />}
              {isStale && <RefreshCcw className="w-4 h-4 text-primary animate-spin" />}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {t("Approved total:")} {formatCurrency(total)}
              {pendingApprovalCount > 0 && ` · ${pendingApprovalCount} ${t("awaiting treasurer")}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select btn-sm !rounded-xl !py-2"
            value={expenseMonth}
            onChange={(e) => setExpenseMonth(e.target.value)}
          >
            <option value="all">{t("All months")}</option>
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
          <button onClick={exportCsv} className="btn btn-secondary btn-sm">
            <Download className="w-4 h-4" /> {t("Export CSV")}
          </button>
          <button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" /> {t("Add Expense")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="card !p-4 border-l-4 border-l-primary">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{t("Maker-Checker")}</p>
          <p className="text-sm font-semibold text-text-primary mt-1">
            {t("Secretary submits bills; treasurer approves before ledger posting.")}
          </p>
        </div>
        <div className={`card !p-4 border-l-4 ${pendingApprovalCount ? "border-l-warning" : "border-l-success"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{t("Pending Approval")}</p>
          <p className="text-2xl font-black text-text-primary mt-1">{pendingApprovalCount}</p>
        </div>
        <div className={`card !p-4 border-l-4 ${missingProofCount ? "border-l-warning" : "border-l-success"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{t("Missing Proof")}</p>
          <p className="text-2xl font-black text-text-primary mt-1">{missingProofCount}</p>
        </div>
        <div className={`card !p-4 border-l-4 ${unverifiedProofCount ? "border-l-warning" : "border-l-success"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{t("Pending Verification")}</p>
          <p className="text-2xl font-black text-text-primary mt-1">{unverifiedProofCount}</p>
        </div>
      </div>

      {canApprove && pendingExpenses.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning-text" />
            {t("Awaiting your approval ({count})").replace("{count}", String(pendingExpenses.length))}
          </h2>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Date")}</th>
                  <th>{t("Description")}</th>
                  <th>{t("Paid To")}</th>
                  <th>{t("Category")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Bill Proof")}</th>
                  <th className="text-right">{t("Amount")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>{pendingExpenses.map((e) => renderExpenseRow(e, true))}</tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content !max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{t("Add Expense")}</h3>
            {viewerRole !== "treasurer" && (
              <p className="text-sm text-text-secondary mb-4 rounded-xl bg-surface/60 border border-border px-3 py-2">
                {t("This will be sent to the treasurer for approval. Budget and ledger update only after approval.")}
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">{t("Description *")}</label>
                <input
                  className="input"
                  placeholder={t("e.g. Lift AMC")}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("Amount *")}</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="₹"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">{t("Category *")}</label>
                  <select
                    className="select"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {EXPENSE_CATEGORY_GROUPS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.categories.map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">{t("Paid To / Vendor")}</label>
                <input
                  className="input"
                  placeholder={t("e.g. ABC Elevator Services")}
                  value={form.paidTo}
                  onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("Date *")}</label>
                <input
                  type="date"
                  className="input"
                  value={form.paidOn}
                  onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">{t("Notes / Reference")}</label>
                <input
                  className="input"
                  placeholder={t("Invoice no, approval note, payment reference")}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-4">
                <label className="label flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  {t("Vendor Bill / Receipt Proof")}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="input mt-2"
                  onChange={(e) => handleProofFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-text-secondary mt-2">
                  {t("Upload the vendor bill so the treasurer can verify before approval. JPG, PNG, WebP, or PDF up to 3 MB.")}
                </p>
                {form.billProofFileName && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary truncate">{form.billProofFileName}</p>
                      <p className="text-[10px] text-text-secondary">{form.billProofFileType}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleProofFile(null)}
                      className="rounded-lg p-1.5 text-text-secondary hover:bg-surface hover:text-danger"
                      title={t("Remove proof")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
                  {t("Cancel")}
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? (
                    <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" />
                  ) : (
                    submitLabel
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectingId && (
        <div className="modal-overlay" onClick={() => setRejectingId(null)}>
          <div className="modal-content !max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">{t("Reject expense")}</h3>
            <label className="label">{t("Reason (optional)")}</label>
            <textarea
              className="input min-h-[80px]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("e.g. Duplicate invoice, amount mismatch")}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setRejectingId(null)} className="btn btn-secondary">
                {t("Cancel")}
              </button>
              <button type="button" onClick={rejectExpense} className="btn btn-primary">
                {t("Reject expense")}
              </button>
            </div>
          </div>
        </div>
      )}

      {approvedExpenses.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {Object.entries(categoryTotals).map(([category, amount]) => (
            <div key={category} className="stat-card !p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                {expenseCategoryLabel(category)}
              </p>
              <p className="text-sm font-black text-text-primary mt-1">{formatCurrency(amount)}</p>
            </div>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : approvedExpenses.length === 0 && pendingExpenses.length === 0 && rejectedExpenses.length === 0 ? (
        <div className="card text-center py-12 text-text-secondary">{t("No records found.")}</div>
      ) : expenseMonth !== "all" ? (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Date")}</th>
                <th>{t("Description")}</th>
                <th>{t("Paid To")}</th>
                <th>{t("Category")}</th>
                <th>{t("Status")}</th>
                <th>{t("Bill Proof")}</th>
                <th className="text-right">{t("Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((e) => renderExpenseRow(e, false))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-8">
          {currentMonthLedger.length > 0 && (
            <div className="space-y-3">
              <ModuleSectionTitle
                title={t("This month")}
                description={t("Approved and rejected expenses for the current billing month.")}
              />
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Date")}</th>
                      <th>{t("Description")}</th>
                      <th>{t("Paid To")}</th>
                      <th>{t("Category")}</th>
                      <th>{t("Status")}</th>
                      <th>{t("Bill Proof")}</th>
                      <th className="text-right">{t("Amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMonthLedger.map((e) => renderExpenseRow(e, false))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {pastLedger.length > 0 && (
            <div className="space-y-3 opacity-95">
              <ModuleSectionTitle
                title={t("Expense history")}
                description={t("Older approved and rejected records kept for audit.")}
              />
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Date")}</th>
                      <th>{t("Description")}</th>
                      <th>{t("Paid To")}</th>
                      <th>{t("Category")}</th>
                      <th>{t("Status")}</th>
                      <th>{t("Bill Proof")}</th>
                      <th className="text-right">{t("Amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastLedger.map((e) => renderExpenseRow(e, false))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
