"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  Download,
  Paperclip,
  RefreshCcw,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useLiveData } from "@/lib/use-live-data";
import { moveWizardStatusLabel, requiresTenantDocuments } from "@society/society-core";

type MoveWizardEvent = {
  id: string;
  type: string;
  residentName: string;
  residentType: string;
  workflowStatus: string;
  shiftingChargeAmount: number;
  shiftingChargePaid: boolean;
  shiftingPaymentRef: string | null;
  scheduledMoveDate: string | null;
  gatePassCode: string | null;
  policeVerificationFileName: string | null;
  policeVerificationDataUrl: string | null;
  leaseAgreementFileName: string | null;
  leaseAgreementDataUrl: string | null;
  rejectedReason: string | null;
  flat: { flatNumber: string; wing: string | null };
};

type MoveWizardResponse = {
  charges: { moveInShiftingCharge: number; moveOutShiftingCharge: number };
  events: MoveWizardEvent[];
  canCreate: boolean;
};

function readProofFile(
  file: File | null,
  onDone: (payload: { dataUrl: string; fileName: string; fileType: string } | null) => void,
) {
  if (!file) {
    onDone(null);
    return;
  }
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) {
    toast.error("Upload JPG, PNG, WebP, or PDF only");
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    toast.error("File must be under 3 MB");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    onDone({
      dataUrl: String(reader.result || ""),
      fileName: file.name,
      fileType: file.type,
    });
  };
  reader.onerror = () => toast.error("Could not read file");
  reader.readAsDataURL(file);
}

export default function MoveWizardPage() {
  const { data, loading, refetch, isStale } = useLiveData<MoveWizardResponse>({
    url: "/api/move-wizard",
    interval: 45_000,
  });

  const [creating, setCreating] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const [form, setForm] = useState({
    type: "move_in",
    residentName: "",
    residentType: "tenant",
    scheduledMoveDate: new Date().toISOString().split("T")[0],
    notes: "",
    policeVerification: null as { dataUrl: string; fileName: string; fileType: string } | null,
    leaseAgreement: null as { dataUrl: string; fileName: string; fileType: string } | null,
  });

  const draft = useMemo(
    () => data?.events.find((event) => event.workflowStatus === "draft") || null,
    [data?.events],
  );
  const workingId = activeDraftId || draft?.id || null;

  const startDraft = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/move-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          residentName: form.residentName,
          residentType: form.residentType,
          scheduledMoveDate: form.scheduledMoveDate,
          notes: form.notes,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Could not start wizard");
        return;
      }
      setActiveDraftId(result.event.id);
      toast.success("Move request draft created");
      refetch();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const patchDraft = async (action: string, extra?: Record<string, unknown>) => {
    if (!workingId) return;
    const res = await fetch(`/api/move-wizard/${workingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result.error || "Update failed");
      return null;
    }
    toast.success(result.message || "Saved");
    refetch();
    return result.event as MoveWizardEvent;
  };

  const saveDocuments = () =>
    patchDraft("update_draft", {
      policeVerification: form.policeVerification,
      leaseAgreement: form.leaseAgreement,
      scheduledMoveDate: form.scheduledMoveDate,
      residentName: form.residentName,
      notes: form.notes,
    });

  const needsDocs = requiresTenantDocuments(form.type, form.residentType);
  const shiftingCharge =
    form.type === "move_out"
      ? data?.charges.moveOutShiftingCharge ?? 0
      : data?.charges.moveInShiftingCharge ?? 0;

  return (
    <div className={isStale ? "opacity-90" : ""}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title flex items-center gap-2">
              Move-In / Move-Out Wizard
              {loading && !data && <div className="spinner !w-4 !h-4" />}
              {isStale && <RefreshCcw className="w-4 h-4 text-primary animate-spin" />}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Upload documents, pay shifting charges, and get a gate pass after manager approval
            </p>
          </div>
        </div>
      </div>

      {!data?.canCreate && !loading && (
        <div className="card mb-6 text-sm text-text-secondary">
          Link your account to a flat to use the self-serve move wizard.
        </div>
      )}

      {data?.canCreate && !draft && !workingId && (
        <div className="card mb-6 space-y-4">
          <h2 className="text-sm font-bold text-text-primary">Start a new request</h2>
          <div className="flex gap-2">
            {(["move_in", "move_out"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((current) => ({ ...current, type }))}
                className={`btn btn-sm ${form.type === type ? "btn-primary" : "btn-secondary"}`}
              >
                {type === "move_in" ? (
                  <ArrowDownLeft className="w-4 h-4" />
                ) : (
                  <ArrowUpRight className="w-4 h-4" />
                )}
                {type === "move_in" ? "Move in" : "Move out"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Resident name</label>
              <input
                className="input"
                value={form.residentName}
                onChange={(e) => setForm({ ...form, residentName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="label">Resident type</label>
              <select
                className="select"
                value={form.residentType}
                onChange={(e) => setForm({ ...form, residentType: e.target.value })}
              >
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
                <option value="family">Family member</option>
              </select>
            </div>
            <div>
              <label className="label">Scheduled move date</label>
              <input
                type="date"
                className="input"
                value={form.scheduledMoveDate}
                onChange={(e) => setForm({ ...form, scheduledMoveDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Shifting charge</label>
              <p className="input !bg-surface font-semibold">{formatCurrency(shiftingCharge)}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={creating || !form.residentName.trim()}
            onClick={startDraft}
            className="btn btn-primary"
          >
            {creating ? "Creating..." : "Continue to documents"}
          </button>
        </div>
      )}

      {(draft || workingId) && (
        <div className="card mb-6 space-y-4 border-l-4 border-l-primary">
          <h2 className="text-sm font-bold text-text-primary">Complete your draft</h2>

          {needsDocs && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-dashed border-border p-4">
                <label className="label flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Police verification
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="input mt-2"
                  onChange={(e) =>
                    readProofFile(e.target.files?.[0] || null, (proof) =>
                      setForm((current) => ({ ...current, policeVerification: proof })),
                    )
                  }
                />
                {form.policeVerification?.fileName && (
                  <p className="text-xs mt-2 text-success">{form.policeVerification.fileName}</p>
                )}
              </div>
              <div className="rounded-xl border border-dashed border-border p-4">
                <label className="label flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Lease agreement
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="input mt-2"
                  onChange={(e) =>
                    readProofFile(e.target.files?.[0] || null, (proof) =>
                      setForm((current) => ({ ...current, leaseAgreement: proof })),
                    )
                  }
                />
                {form.leaseAgreement?.fileName && (
                  <p className="text-xs mt-2 text-success">{form.leaseAgreement.fileName}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveDocuments} className="btn btn-secondary btn-sm">
              Save documents
            </button>
            {shiftingCharge > 0 && !(draft?.shiftingChargePaid) && (
              <>
                <input
                  className="input !w-40 !py-1.5"
                  placeholder="UPI UTR / ref"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => patchDraft("pay_shifting", { utrNumber: utr, paidVia: "upi" })}
                  className="btn btn-secondary btn-sm"
                >
                  Confirm shifting payment
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => patchDraft("submit")}
              className="btn btn-primary btn-sm"
            >
              Submit for approval
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            After the secretary approves, your gate pass PDF and entry code will appear below.
          </p>
        </div>
      )}

      {data?.events && data.events.length > 0 && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Flat</th>
                <th>Resident</th>
                <th>Move date</th>
                <th>Status</th>
                <th>Gate pass</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.id}>
                  <td>{event.type === "move_in" ? "Move in" : "Move out"}</td>
                  <td>
                    {event.flat.wing ? `${event.flat.wing}-` : ""}
                    {event.flat.flatNumber}
                  </td>
                  <td>{event.residentName}</td>
                  <td className="text-text-secondary">
                    {event.scheduledMoveDate ? formatDate(event.scheduledMoveDate) : "—"}
                  </td>
                  <td>{moveWizardStatusLabel(event.workflowStatus)}</td>
                  <td>
                    {event.gatePassCode ? (
                      <code className="text-xs font-bold">{event.gatePassCode}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right">
                    {event.workflowStatus === "approved" && (
                      <button
                        type="button"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = `/api/move-wizard/${event.id}/gate-pass`;
                          link.download = "gate_pass.pdf";
                          link.click();
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    )}
                    {event.workflowStatus === "rejected" && event.rejectedReason && (
                      <span className="text-[10px] text-danger">{event.rejectedReason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.canCreate && (
        <p className="text-xs text-text-secondary mt-4">
          Need a society clearance certificate first?{" "}
          <Link href="/noc" className="text-primary font-semibold">
            Request NOC
          </Link>
        </p>
      )}
    </div>
  );
}
