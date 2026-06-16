"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  Landmark,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { formatCurrency } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";

interface ReconciliationSessionSummary {
  id: string;
  fileName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  totalLines: number;
  matchedLines: number;
  createdAt: string;
  confirmedAt: string | null;
}

interface ReconciliationLine {
  id: string;
  rowIndex: number;
  transactionDate: string;
  amount: number;
  reference: string | null;
  description: string | null;
  matchStatus: string;
  matchScore: number | null;
  matchedSourceType: string | null;
  matchedSourceId: string | null;
}

interface ReconciliationSessionDetail extends ReconciliationSessionSummary {
  lines: ReconciliationLine[];
}

function periodLabel(session: ReconciliationSessionSummary, t: (key: string) => string) {
  if (!session.periodStart || !session.periodEnd) return session.fileName || t("Bank statement");
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(session.periodStart)} – ${fmt(session.periodEnd)}`;
}

export default function BankReconciliationPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<ReconciliationSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<ReconciliationSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/reconciliation");
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to load reconciliation sessions");
        return;
      }
      setSessions(data.sessions || []);
    } catch {
      toastT.error("Failed to load reconciliation sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/accounting/reconciliation/${sessionId}`);
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Failed to load session");
        return;
      }
      setActiveSession(data.session);
    } catch {
      toastT.error("Failed to load session");
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/accounting/reconciliation", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Upload failed");
        return;
      }
      toastT.success(
        t("{matches} matches suggested from {lines} bank lines")
          .replace("{matches}", String(data.summary.suggestedMatches))
          .replace("{lines}", String(data.summary.totalLines)),
      );
      await loadSessions();
      setActiveSession(data.session);
    } catch {
      toastT.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const confirmAll = async () => {
    if (!activeSession || activeSession.status === "confirmed") return;
    const suggested = activeSession.lines.filter((line) => line.matchStatus === "suggested").length;
    if (suggested === 0) {
      toastT.error("No suggested matches to confirm");
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch(`/api/accounting/reconciliation/${activeSession.id}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toastT.error(data.error || "Confirm failed");
        return;
      }
      toastT.success(data.message || "Reconciliation confirmed");
      setActiveSession(data.session);
      await loadSessions();
    } catch {
      toastT.error("Confirm failed");
    } finally {
      setConfirming(false);
    }
  };

  const suggestedCount = activeSession?.lines.filter((line) => line.matchStatus === "suggested").length ?? 0;
  const unmatchedCount = activeSession?.lines.filter((line) => line.matchStatus === "unmatched").length ?? 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-border transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </Link>
          <div className="flex items-center gap-3">
            <Landmark className="w-6 h-6 text-primary" />
            <div>
              <h1 className="page-title">{t("Bank Reconciliation")}</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {t("Upload your bank statement and auto-match entries to society payments and expenses")}
              </p>
            </div>
          </div>
        </div>
        <button onClick={loadSessions} className="btn btn-secondary btn-sm">
          <RefreshCcw className="w-4 h-4" /> {t("Refresh")}
        </button>
      </div>

      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">{t("Upload bank statement")}</h2>
            <p className="text-xs text-text-secondary mt-1">
              {t("CSV or Excel export from HDFC, ICICI, SBI, Axis, etc. We match amount, date, and reference automatically.")}
            </p>
          </div>
        </div>

        <div
          className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) uploadFile(file);
          }}
        >
          <FileSpreadsheet className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="font-semibold text-text-primary">{t("Drop bank statement here")}</p>
          <p className="text-xs text-text-secondary mt-1">{t("or click to browse · CSV / XLSX")}</p>
          {uploading && <div className="spinner mx-auto mt-4" />}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1">
          <h2 className="font-semibold text-text-primary mb-4">{t("Recent uploads")}</h2>
          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("No reconciliation sessions yet.")}</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    activeSession?.id === session.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-text-primary truncate">{session.fileName || t("Statement")}</p>
                    <StatusBadge status={session.status} />
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{periodLabel(session, t)}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">
                    {t("{matched}/{total} matched")
                      .replace("{matched}", String(session.matchedLines))
                      .replace("{total}", String(session.totalLines))}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card lg:col-span-2">
          {!activeSession ? (
            <div className="text-center py-16 text-text-secondary">
              <Landmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{t("Select a session or upload a new bank statement to review matches.")}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="font-semibold text-text-primary">{activeSession.fileName || t("Bank statement")}</h2>
                  <p className="text-xs text-text-secondary mt-1">{periodLabel(activeSession, t)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                    {t("{count} suggested").replace("{count}", String(suggestedCount))}
                  </span>
                  <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                    {t("{count} unmatched").replace("{count}", String(unmatchedCount))}
                  </span>
                  {activeSession.status !== "confirmed" && suggestedCount > 0 && (
                    <button onClick={confirmAll} disabled={confirming} className="btn btn-primary btn-sm">
                      {confirming ? <div className="spinner !w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      {t("Confirm all matches")}
                    </button>
                  )}
                </div>
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Date")}</th>
                      <th>{t("Description")}</th>
                      <th>{t("Amount")}</th>
                      <th>{t("Match")}</th>
                      <th>{t("Score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSession.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="whitespace-nowrap text-sm">
                          {new Date(line.transactionDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td className="min-w-[180px]">
                          <p className="text-sm font-medium truncate">{line.description || "—"}</p>
                          {line.reference && (
                            <p className="text-[10px] text-text-secondary truncate">{line.reference}</p>
                          )}
                        </td>
                        <td className={`font-semibold ${line.amount >= 0 ? "text-emerald-700" : "text-danger"}`}>
                          {line.amount >= 0 ? "+" : "-"}
                          {formatCurrency(Math.abs(line.amount))}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {line.matchStatus === "confirmed" ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : line.matchStatus === "suggested" ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            ) : null}
                            <div>
                              <StatusBadge status={line.matchStatus} />
                              {line.matchedSourceType && (
                                <p className="text-[10px] text-text-secondary mt-0.5 capitalize">
                                  {line.matchedSourceType}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-sm text-text-secondary">
                          {line.matchScore ? `${Math.round(line.matchScore)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
