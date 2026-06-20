"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useState } from "react";
import Link from "next/link";
import {
  FileBadge,
  Download,
  ShieldCheck,
  AlertTriangle,
  RefreshCcw,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useLiveData } from "@/lib/use-live-data";
import { nocPurposeLabel } from "@society/operations-core";
import { getAuthHeaders } from "@/lib/client-session";

type NocRequest = {
  id: string;
  certificateNo: string;
  purpose: string;
  status: string;
  issuedAt: string;
  validUntil: string;
  verificationHash: string;
  requesterName: string;
  flat: { flatNumber: string; wing: string | null };
};

type NocResponse = {
  purposes: string[];
  eligibility: {
    eligible: boolean;
    totalOutstanding: number;
    pendingBills: Array<{ period: string; remainingAmount: number }>;
    message: string | null;
  } | null;
  requests: NocRequest[];
  canRequest: boolean;
  viewerRole: string;
};

export default function NocPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [purpose, setPurpose] = useState("general");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, refetch, isStale } = useLiveData<NocResponse>({
    url: "/api/noc",
    interval: 60_000,
  });

  const eligibility = data?.eligibility;
  const requests = data?.requests || [];
  const canRequest = data?.canRequest ?? false;
  const purposes = data?.purposes || ["sale", "rental", "passport", "general"];

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/noc", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ purpose, notes }),
      });
      const result = await res.json();
      if (res.status === 402) {
        toastT.error(result.message || "Clear outstanding dues first");
        refetch();
        return;
      }
      if (!res.ok) {
        toastT.error(result.error || "Could not generate NOC");
        return;
      }
      toastT.success(result.message || "NOC ready");
      refetch();
    } catch {
      toastT.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadNoc = async (id: string, certificateNo: string) => {
    try {
      const response = await fetch(`/api/noc/${id}/download`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Download failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${certificateNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toastT.error("Could not download NOC PDF");
    }
  };

  const verificationCode = (hash: string) => hash.slice(0, 12).toUpperCase();

  return (
    <div className={isStale ? "opacity-90 transition-opacity" : "transition-opacity"}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <FileBadge className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title flex items-center gap-2">
              {t("Society NOC")}
              {loading && !data && <div className="spinner !w-4 !h-4" />}
              {isStale && <RefreshCcw className="w-4 h-4 text-primary animate-spin" />}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Instant No Objection Certificate when all maintenance dues are cleared
            </p>
          </div>
        </div>
      </div>

      {eligibility && !eligibility.eligible && (
        <div className="card mb-6 border-l-4 border-l-warning bg-warning-bg/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-text shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-text-primary">Dues must be cleared first</p>
              <p className="text-sm text-text-secondary mt-1">{eligibility.message}</p>
              <p className="text-lg font-black text-danger mt-2">
                Outstanding: {formatCurrency(eligibility.totalOutstanding)}
              </p>
              <Link href="/my-bills" className="btn btn-primary btn-sm mt-3 inline-flex">
                <CreditCard className="w-4 h-4" /> Pay from My Bills
              </Link>
            </div>
          </div>
        </div>
      )}

      {eligibility?.eligible && canRequest && (
        <div className="card mb-6 border-l-4 border-l-success">
          <div className="flex items-start gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-text-primary">You are eligible for an instant NOC</p>
              <p className="text-sm text-text-secondary mt-1">
                No outstanding society dues detected. Select the purpose and generate your certificate.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Purpose</label>
              <select className="select w-full" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {purposes.map((item) => (
                  <option key={item} value={item}>
                    {nocPurposeLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input w-full"
                placeholder="e.g. Bank name, buyer name"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={handleRequest}
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? (
                <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" />
              ) : (
                "Generate NOC PDF"
              )}
            </button>
          </div>
        </div>
      )}

      {!canRequest && !loading && (
        <div className="card mb-6 text-sm text-text-secondary">
          NOC self-service is available to residents linked to a flat. Contact your society office if your account is not linked.
        </div>
      )}

      {requests.length > 0 ? (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Certificate</th>
                <th>Flat</th>
                <th>Purpose</th>
                <th>Issued</th>
                <th>Valid until</th>
                <th>Verify code</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const expired = new Date(request.validUntil).getTime() < Date.now();
                return (
                  <tr key={request.id}>
                    <td>
                      <p className="font-medium">{request.certificateNo}</p>
                      <p className="text-[10px] text-text-secondary">{request.requesterName}</p>
                    </td>
                    <td>
                      {request.flat.wing
                        ? `${request.flat.wing}-${request.flat.flatNumber}`
                        : request.flat.flatNumber}
                    </td>
                    <td>{nocPurposeLabel(request.purpose)}</td>
                    <td className="text-text-secondary">{formatDate(request.issuedAt)}</td>
                    <td>
                      <span className={expired ? "text-danger font-medium" : "text-text-secondary"}>
                        {formatDate(request.validUntil)}
                      </span>
                    </td>
                    <td>
                      <code className="text-[10px] bg-surface px-2 py-1 rounded">
                        {verificationCode(request.verificationHash)}
                      </code>
                    </td>
                    <td className="text-right">
                      {!expired && request.status === "issued" && (
                        <button
                          type="button"
                          onClick={() => downloadNoc(request.id, request.certificateNo)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </button>
                      )}
                      {expired && (
                        <span className="text-[10px] font-bold text-danger uppercase">Expired</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="card text-center py-12 text-text-secondary">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-text-secondary/50" />
            No NOC certificates yet.
          </div>
        )
      )}
    </div>
  );
}
