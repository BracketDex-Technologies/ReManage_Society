"use client";

import { useEffect, useState } from "react";
import { Download, BarChart3, TrendingUp, PieChart, IndianRupee, AlertTriangle, Landmark, Archive, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { formatCurrency } from "@/lib/utils";
import { BarChart, DonutChart, LineChart } from "@/components/ui/Charts";
import { expenseCategoryLabel } from "@/lib/finance-categories";
import { PeriodNavigator } from "@/components/ux/HistoryKit";
import { currentPeriod } from "@/lib/history-utils";

interface MonthlyReport {
  summary: {
    totalFlats: number;
    activeFlats: number;
    vacantFlats: number;
    billsGenerated: number;
    paid: number;
    pending: number;
    totalCollected: number;
    totalPending: number;
    collectionRate: number;
  };
  paymentMethodBreakdown: Array<{ method: string; count: number; amount: number }>;
  pendingFlats: Array<{ flatNumber: string; ownerName: string; contact: string; amount: number }>;
}

interface AnnualReport {
  year: number;
  months: Array<{ period: string; month: string; generated: number; collected: number; pending: number; rate: number }>;
  totals: { generated: number; collected: number; pending: number; rate: number };
}

interface FinancialReport {
  period: string;
  income: {
    maintenance: number;
    marketplace: number;
    other: number;
    total: number;
  };
  expenses: {
    maintenance: number;
    salary: number;
    repair: number;
    utilities: number;
    events: number;
    other: number;
    total: number;
    byCategory: Record<string, number>;
  };
  profitOrLoss: number;
  funds: Array<{ name: string; type: string; balance: number }>;
  budgets: Array<{ category: string; planned: number; actual: number; variance: number }>;
}

function parseMonthlyReport(payload: unknown): MonthlyReport | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  if ("error" in data) return null;
  if (!data.summary || typeof data.summary !== "object") return null;

  const summary = data.summary as Record<string, unknown>;
  return {
    summary: {
      totalFlats: Number(summary.totalFlats ?? 0),
      activeFlats: Number(summary.activeFlats ?? 0),
      vacantFlats: Number(summary.vacantFlats ?? 0),
      billsGenerated: Number(summary.billsGenerated ?? 0),
      paid: Number(summary.paid ?? 0),
      pending: Number(summary.pending ?? 0),
      totalCollected: Number(summary.totalCollected ?? 0),
      totalPending: Number(summary.totalPending ?? 0),
      collectionRate: Number(summary.collectionRate ?? 0),
    },
    paymentMethodBreakdown: Array.isArray(data.paymentMethodBreakdown)
      ? (data.paymentMethodBreakdown as MonthlyReport["paymentMethodBreakdown"])
      : [],
    pendingFlats: Array.isArray(data.pendingFlats)
      ? (data.pendingFlats as MonthlyReport["pendingFlats"])
      : [],
  };
}

const METHOD_COLORS: Record<string, string> = {
  cash: "#22c55e",
  upi: "#3b82f6",
  neft: "#8b5cf6",
  cheque: "#f59e0b",
  unknown: "#6b7280",
};

export default function ReportsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [tab, setTab] = useState<"monthly" | "annual" | "financial">("monthly");
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null);
  const [annual, setAnnual] = useState<AnnualReport | null>(null);
  const [financial, setFinancial] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportingAuditor, setExportingAuditor] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [auditorFiscalYear, setAuditorFiscalYear] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
  });
  const [period, setPeriod] = useState(currentPeriod);

  const periodLabel = (() => {
    const [y, m] = period.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  })();

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoadError(null);
      try {
        if (tab === "monthly") {
          const r = await fetch(`/api/reports/monthly?period=${period}`);
          const d = await r.json();
          if (cancelled) return;
          const parsed = parseMonthlyReport(d);
          if (parsed) {
            setMonthly(parsed);
          } else {
            setMonthly(null);
            setLoadError(typeof d?.error === "string" ? d.error : t("Failed to load monthly report"));
          }
          setLoading(false);
        } else if (tab === "annual") {
          const year = period.split("-")[0];
          const r = await fetch(`/api/reports/annual?year=${year}`);
          const d = await r.json();
          if (cancelled) return;
          if (r.ok && Array.isArray(d?.months)) {
            setAnnual(d);
          } else {
            setAnnual(null);
            setLoadError(typeof d?.error === "string" ? d.error : t("Failed to load annual report"));
          }
          setLoading(false);
        } else if (tab === "financial") {
          const r = await fetch(`/api/reports/financial?period=${period}`);
          const d = await r.json();
          if (cancelled) return;
          if (r.ok && d?.income && d?.expenses) {
            setFinancial(d);
          } else {
            setFinancial(null);
            setLoadError(typeof d?.error === "string" ? d.error : t("Failed to load financial report"));
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError(t("Failed to load report data"));
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [tab, period]);

  const downloadAuditorExport = async () => {
    setExportingAuditor(true);
    try {
      const res = await fetch(`/api/reports/auditor-export?year=${encodeURIComponent(auditorFiscalYear)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toastT.error(data.error || "Could not generate auditor export");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] || `auditor_export_${auditorFiscalYear}.zip`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      toastT.success("Auditor export downloaded");
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setExportingAuditor(false);
    }
  };

  const exportPdf = async () => {
    let payload: { type: "monthly" | "annual" | "financial"; period: string; data: unknown } | null = null;

    if (tab === "monthly" && monthly) {
      payload = { type: "monthly", period, data: monthly };
    } else if (tab === "annual" && annual) {
      payload = { type: "annual", period: period.split("-")[0], data: annual };
    } else if (tab === "financial" && financial) {
      payload = { type: "financial", period, data: financial };
    }

    if (!payload) {
      toastT.error(t("Load a report before exporting PDF"));
      return;
    }

    setExportingPdf(true);
    try {
      const res = await fetch("/api/reports/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toastT.error(typeof data?.error === "string" ? data.error : t("Could not generate PDF"));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName =
        match?.[1] ||
        (payload.type === "annual"
          ? `annual-report-${payload.period}.pdf`
          : payload.type === "financial"
            ? `financial-report-${payload.period}.pdf`
            : `monthly-report-${payload.period}.pdf`);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      toastT.success(t("PDF downloaded"));
    } catch {
      toastT.error(t("Something went wrong"));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title">{t("Financial Reports")}</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {tab === "monthly" ? `${t("Monthly Report")} — ${periodLabel}` : `${t("Annual Summary")} — ${period.split("-")[0]}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(tab === "monthly" || tab === "financial") && (
            <PeriodNavigator period={period} onChange={setPeriod} />
          )}
          {tab === "annual" && (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-1">
              <button
                type="button"
                onClick={() => setPeriod(`${Number(period.split("-")[0]) - 1}-01`)}
                className="rounded p-1.5 hover:bg-surface"
                aria-label={t("Previous year")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[80px] px-2 text-center text-sm font-medium">{period.split("-")[0]}</span>
              <button
                type="button"
                onClick={() => setPeriod(`${Number(period.split("-")[0]) + 1}-01`)}
                className="rounded p-1.5 hover:bg-surface"
                aria-label={t("Next year")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <Link href="/reports/reconciliation" className="btn btn-primary btn-sm">
            <Landmark className="w-4 h-4" /> {t("Bank Reconciliation")}
          </Link>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-1">
            <label htmlFor="auditor-fy" className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              {t("FY")}
            </label>
            <select
              id="auditor-fy"
              className="select !py-1 !px-2 !text-sm !border-0 !shadow-none !bg-transparent"
              value={auditorFiscalYear}
              onChange={(e) => setAuditorFiscalYear(e.target.value)}
            >
              {[0, 1, 2].map((offset) => {
                const now = new Date();
                const baseYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
                const start = baseYear - offset;
                const label = `${start}-${String(start + 1).slice(-2)}`;
                return (
                  <option key={label} value={label}>
                    {label}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={downloadAuditorExport}
              disabled={exportingAuditor}
              className="btn btn-secondary btn-sm"
              title={t("Trial balance, balance sheet, ledger, expense proofs")}
            >
              {exportingAuditor ? (
                <div className="spinner !w-4 !h-4" />
              ) : (
                <>
                  <Archive className="w-4 h-4" /> {t("Auditor ZIP")}
                </>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={exportPdf}
            disabled={exportingPdf || loading || Boolean(loadError)}
            className="btn btn-secondary btn-sm"
          >
            {exportingPdf ? (
              <div className="spinner !w-4 !h-4" />
            ) : (
              <>
                <Download className="w-4 h-4" /> {t("Export PDF")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-lg p-0.5 mb-6 w-fit">
        {(["monthly", "annual", "financial"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => {
              setTab(tabKey);
              setLoading(true);
              setLoadError(null);
              setMonthly(null);
              setAnnual(null);
              setFinancial(null);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === tabKey ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tabKey === "monthly" ? t("Monthly Collection") : tabKey === "annual" ? t("Annual Summary") : t("Income & Expense (P&L)")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : loadError ? (
        <div className="card text-center py-12 text-text-secondary">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-warning" />
          <p>{loadError}</p>
        </div>
      ) : tab === "monthly" && monthly?.summary ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="stat-card border-l-4 border-l-primary">
              <p className="text-xs text-text-secondary">{t("Total Inventory")}</p>
              <p className="text-2xl font-bold mt-1">{monthly.summary.totalFlats}</p>
              <p className="text-xs text-text-secondary">{t("created flats")}</p>
            </div>
            <div className="stat-card border-l-4 border-l-indigo-500">
              <p className="text-xs text-text-secondary">{t("Active Flats")}</p>
              <p className="text-2xl font-bold mt-1">{monthly.summary.activeFlats}</p>
              <p className="text-xs text-text-secondary">{monthly.summary.billsGenerated} {t("invoices generated")}</p>
            </div>
            <div className="stat-card border-l-4 border-l-slate-400">
              <p className="text-xs text-text-secondary">{t("Vacant / Unlinked")}</p>
              <p className="text-2xl font-bold mt-1">{monthly.summary.vacantFlats}</p>
              <p className="text-xs text-text-secondary">{t("not billable yet")}</p>
            </div>
            <div className="stat-card border-l-4 border-l-success">
              <p className="text-xs text-text-secondary">{t("Collected")}</p>
              <p className="text-2xl font-bold mt-1 text-success">{formatCurrency(monthly.summary.totalCollected)}</p>
              <p className="text-xs text-success">{monthly.summary.paid} {t("flats paid")}</p>
            </div>
            <div className="stat-card border-l-4 border-l-danger">
              <p className="text-xs text-text-secondary">{t("Pending")}</p>
              <p className="text-2xl font-bold mt-1 text-danger">{formatCurrency(monthly.summary.totalPending)}</p>
              <p className="text-xs text-danger">{monthly.summary.pending} {t("flats pending")}</p>
            </div>
            <div className="stat-card border-l-4 border-l-warning">
              <p className="text-xs text-text-secondary">{t("Collection Rate")}</p>
              <p className="text-2xl font-bold mt-1">{monthly.summary.collectionRate}%</p>
              <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${monthly.summary.collectionRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Payment Method + P&L */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Method Chart */}
            {monthly.paymentMethodBreakdown.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" />
                  {t("Payment Methods")}
                </h3>
                <DonutChart
                  data={monthly.paymentMethodBreakdown.map((m) => ({
                    label: m.method.toUpperCase(),
                    value: m.amount,
                    color: METHOD_COLORS[m.method] || METHOD_COLORS.unknown,
                  }))}
                  centerValue={`${monthly.paymentMethodBreakdown.reduce((s, m) => s + m.count, 0)}`}
                  centerLabel={t("Payments")}
                  size={170}
                />
                <div className="mt-4 space-y-2">
                  {monthly.paymentMethodBreakdown.map((m) => (
                    <div key={m.method} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: METHOD_COLORS[m.method] || METHOD_COLORS.unknown }}
                        />
                        <span className="uppercase font-medium">{m.method}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(m.amount)}</span>
                        <span className="text-text-secondary ml-2">({m.count} {t("flats")})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Income vs Collected Summary */}
            <div className="card">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary" />
                {t("Income Summary")}
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                  <p className="text-xs text-success-text font-medium">{t("Total Collected")}</p>
                  <p className="text-3xl font-bold text-success-text mt-1">{formatCurrency(monthly.summary.totalCollected)}</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl">
                  <p className="text-xs text-danger-text font-medium">{t("Total Pending")}</p>
                  <p className="text-3xl font-bold text-danger-text mt-1">{formatCurrency(monthly.summary.totalPending)}</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <p className="text-xs text-primary font-medium">{t("Expected Total")}</p>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {formatCurrency(monthly.summary.totalCollected + monthly.summary.totalPending)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Flats Table */}
          {monthly.pendingFlats.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger" />
                {t("Pending Active Flats ({count})").replace("{count}", String(monthly.pendingFlats.length))}
              </h3>
              <div className="table-wrapper !border-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Flat")}</th>
                      <th>{t("Owner")}</th>
                      <th className="hidden sm:table-cell">{t("Contact")}</th>
                      <th className="text-right">{t("Amount")}</th>
                      <th className="text-right">{t("Action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.pendingFlats.map((f, i) => (
                      <tr key={i}>
                        <td className="font-medium">{f.flatNumber}</td>
                        <td>{f.ownerName}</td>
                        <td className="hidden sm:table-cell text-text-secondary">{f.contact}</td>
                        <td className="text-right font-medium text-danger">{formatCurrency(f.amount)}</td>
                        <td className="text-right">
                          <button
                            onClick={() => window.open(`https://wa.me/91${f.contact}`, "_blank")}
                            className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                          >
                            {t("WhatsApp")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : tab === "annual" && annual ? (
        <div className="space-y-6">
          {/* Annual Chart */}
          <div className="card">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t("Annual Collection Trend — {year}").replace("{year}", String(annual.year))}
            </h3>
            <BarChart
              data={annual.months.filter((m) => m.generated > 0).map((m) => ({
                label: m.month.slice(0, 3),
                value1: m.collected,
                value2: m.pending,
              }))}
              labels={[t("Collected"), t("Pending")]}
              colors={["#22c55e", "#ef4444"]}
              height={260}
            />
          </div>

          {/* Annual collection rate trend */}
          <div className="card">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              {t("Monthly Collection Rate")}
            </h3>
            <LineChart
              data={annual.months.filter((m) => m.generated > 0).map((m) => ({
                label: m.month.slice(0, 3),
                value: m.rate,
              }))}
              color="#1e40af"
              height={200}
            />
          </div>

          {/* Annual Table */}
          <div className="card">
            <h3 className="font-semibold text-sm mb-4">{t("Detailed Breakdown")}</h3>
            <div className="table-wrapper !border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Month")}</th>
                    <th className="text-right">{t("Generated")}</th>
                    <th className="text-right">{t("Collected")}</th>
                    <th className="text-right">{t("Pending")}</th>
                    <th className="text-right">{t("Rate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {annual.months.filter((m) => m.generated > 0).map((m) => (
                    <tr key={m.period}>
                      <td className="font-medium">{m.month}</td>
                      <td className="text-right">{formatCurrency(m.generated)}</td>
                      <td className="text-right text-success">{formatCurrency(m.collected)}</td>
                      <td className="text-right text-danger">{formatCurrency(m.pending)}</td>
                      <td className="text-right">
                        <span className={`font-medium ${m.rate >= 80 ? "text-success" : m.rate >= 50 ? "text-warning" : "text-danger"}`}>
                          {m.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-surface font-semibold">
                    <td>{t("Total")}</td>
                    <td className="text-right">{formatCurrency(annual.totals.generated)}</td>
                    <td className="text-right text-success">{formatCurrency(annual.totals.collected)}</td>
                    <td className="text-right text-danger">{formatCurrency(annual.totals.pending)}</td>
                    <td className="text-right">{annual.totals.rate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === "financial" && financial ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card border-l-4 border-l-success">
              <p className="text-xs text-text-secondary">{t("Total Income")}</p>
              <p className="text-2xl font-bold mt-1 text-success">{formatCurrency(financial.income.total)}</p>
            </div>
            <div className="card border-l-4 border-l-danger">
              <p className="text-xs text-text-secondary">{t("Total Expenses")}</p>
              <p className="text-2xl font-bold mt-1 text-danger">{formatCurrency(financial.expenses.total)}</p>
            </div>
            <div className={`card border-l-4 ${financial.profitOrLoss >= 0 ? 'border-l-success' : 'border-l-danger'}`}>
              <p className="text-xs text-text-secondary">{t("Net Profit / Loss")}</p>
              <p className={`text-2xl font-bold mt-1 ${financial.profitOrLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                {financial.profitOrLoss >= 0 ? "+" : ""}{formatCurrency(financial.profitOrLoss)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold text-sm mb-4 border-b border-border pb-2">{t("Income Breakdown")}</h3>
              <div className="space-y-3">
                <div className="flex justify-between"><span>{t("Maintenance Collection")}</span><span className="font-medium">{formatCurrency(financial.income.maintenance)}</span></div>
                <div className="flex justify-between"><span>{t("Marketplace & Amenities")}</span><span className="font-medium">{formatCurrency(financial.income.marketplace)}</span></div>
                <div className="flex justify-between"><span>{t("Other Receipts")}</span><span className="font-medium">{formatCurrency(financial.income.other)}</span></div>
                <div className="flex justify-between pt-2 border-t border-border font-bold"><span>{t("Total Income")}</span><span className="text-success">{formatCurrency(financial.income.total)}</span></div>
              </div>
            </div>
            <div className="card">
              <h3 className="font-semibold text-sm mb-4 border-b border-border pb-2">{t("Expense Breakdown")}</h3>
              <div className="space-y-3">
                {Object.entries(financial.expenses.byCategory || {})
                  .filter(([, amount]) => amount > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => (
                    <div key={category} className="flex justify-between gap-4">
                      <span>{expenseCategoryLabel(category)}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                {Object.values(financial.expenses.byCategory || {}).every((amount) => amount <= 0) && (
                  <p className="text-sm text-text-secondary">{t("No expenses recorded for this period.")}</p>
                )}
                <div className="flex justify-between pt-2 border-t border-border font-bold"><span>{t("Total Expense")}</span><span className="text-danger">{formatCurrency(financial.expenses.total)}</span></div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
