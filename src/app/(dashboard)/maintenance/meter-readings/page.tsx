"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type MeterType = "water" | "electricity_grid" | "electricity_dg" | "gas";

interface PreviewRow {
  rowIndex: number;
  flatNumber: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  chargeAmount: number;
  meterType: MeterType;
  applyStatus: "ready" | "invalid" | "flat_not_found" | "bill_missing" | "bill_locked";
  errors: string[];
}

interface PreviewPayload {
  fileName: string;
  preview: {
    period: string;
    meterType: MeterType;
    summary: {
      totalRows: number;
      validRows: number;
      invalidRows: number;
      readyRows: number;
      flatNotFoundRows: number;
      billMissingRows: number;
      billLockedRows: number;
      totalUnits: number;
      totalCharge: number;
    };
    rows: PreviewRow[];
  };
}

interface ImportSession {
  id: string;
  period: string;
  meterType: string;
  fileName: string | null;
  status: string;
  totalRows: number;
  appliedRows: number;
  skippedRows: number;
  totalCharge: number;
  createdAt: string;
  appliedAt: string | null;
}

const METER_OPTIONS: Array<{ value: MeterType; label: string }> = [
  { value: "water", label: "Water" },
  { value: "electricity_grid", label: "Electricity (Grid)" },
  { value: "electricity_dg", label: "Electricity (DG/Generator)" },
  { value: "gas", label: "Piped Gas" },
];

function applyStatusLabel(status: PreviewRow["applyStatus"]) {
  switch (status) {
    case "ready":
      return "Ready";
    case "flat_not_found":
      return "Flat not found";
    case "bill_missing":
      return "No bill";
    case "bill_locked":
      return "Bill locked";
    default:
      return "Invalid";
  }
}

function applyStatusBadge(status: PreviewRow["applyStatus"]) {
  const label = applyStatusLabel(status);
  if (status === "ready") return <span className="badge badge-active">{label}</span>;
  if (status === "bill_missing" || status === "flat_not_found") {
    return <span className="badge badge-pending">{label}</span>;
  }
  return <span className="badge badge-inactive">{label}</span>;
}

export default function MeterReadingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [meterType, setMeterType] = useState<MeterType>("water");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const pendingFileRef = useRef<File | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/maintenance/meter-readings?period=${period}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load import history");
        return;
      }
      setSessions(data.sessions || []);
    } catch {
      toast.error("Failed to load import history");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const uploadFile = async (file: File, mode: "preview" | "apply") => {
    if (mode === "preview") setUploading(true);
    else setApplying(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("period", period);
      formData.append("meterType", meterType);

      const endpoint =
        mode === "preview"
          ? "/api/maintenance/meter-readings"
          : "/api/maintenance/meter-readings/apply";

      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }

      if (mode === "preview") {
        pendingFileRef.current = file;
        setPreview({ fileName: file.name, preview: data.preview });
        toast.success(`Parsed ${data.preview.summary.totalRows} rows`);
        return;
      }

      toast.success(`Applied ${data.session.appliedRows} readings (${formatCurrency(data.session.totalCharge)})`);
      setPreview(null);
      pendingFileRef.current = null;
      await loadSessions();
    } catch {
      toast.error(mode === "preview" ? "Preview failed" : "Import failed");
    } finally {
      setUploading(false);
      setApplying(false);
    }
  };

  const applyPreview = async () => {
    if (!pendingFileRef.current) {
      toast.error("Upload the file again before applying");
      return;
    }
    await uploadFile(pendingFileRef.current, "apply");
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/maintenance" className="btn btn-secondary btn-sm flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Maintenance
          </Link>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Gauge className="w-6 h-6 text-primary" />
              Meter Reading Import
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Bulk import water, grid, DG, or gas readings and add utility charges to pending maintenance bills.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Billing Period</label>
            <input
              type="month"
              className="input"
              value={period}
              onChange={(e) => {
                setPreview(null);
                pendingFileRef.current = null;
                setPeriod(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="label">Meter Type</label>
            <select
              className="select"
              value={meterType}
              onChange={(e) => {
                setPreview(null);
                pendingFileRef.current = null;
                setMeterType(e.target.value as MeterType);
              }}
            >
              {METER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {uploading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload CSV / Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFile(file, "preview");
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border bg-surface/60 p-4 text-sm text-text-secondary">
          Expected columns: <strong>Flat No</strong>, <strong>Previous Reading</strong>, <strong>Current Reading</strong>.
          Optional: Meter Type. Generate monthly maintenance bills first — utility charges attach to pending bills only.
        </div>
      </div>

      {preview && (
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Preview — {preview.fileName}
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                {preview.preview.summary.readyRows} ready · {preview.preview.summary.invalidRows} invalid ·{" "}
                {formatCurrency(preview.preview.summary.totalCharge)} total utility charge
              </p>
            </div>
            <button
              onClick={applyPreview}
              disabled={applying || preview.preview.summary.readyRows === 0}
              className="btn btn-primary flex items-center gap-2"
            >
              {applying ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Apply to {preview.preview.summary.readyRows} bills
            </button>
          </div>

          {(preview.preview.summary.billMissingRows > 0 || preview.preview.summary.billLockedRows > 0) && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p>
                {preview.preview.summary.billMissingRows > 0 &&
                  `${preview.preview.summary.billMissingRows} flats have no pending maintenance bill for ${period}. `}
                {preview.preview.summary.billLockedRows > 0 &&
                  `${preview.preview.summary.billLockedRows} bills are already paid or invoiced and were skipped.`}
              </p>
            </div>
          )}

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Flat</th>
                  <th>Previous</th>
                  <th>Current</th>
                  <th>Units</th>
                  <th>Charge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.rows.map((row) => (
                  <tr key={row.rowIndex}>
                    <td className="font-medium">{row.flatNumber}</td>
                    <td>{row.previousReading}</td>
                    <td>{row.currentReading}</td>
                    <td>{row.unitsConsumed}</td>
                    <td>{formatCurrency(row.chargeAmount)}</td>
                    <td>
                      {applyStatusBadge(row.applyStatus)}
                      {row.errors[0] && (
                        <p className="text-xs text-danger mt-1">{row.errors[0]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent Imports</h2>
          <button onClick={loadSessions} className="btn btn-secondary btn-sm">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner" /></div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-secondary">No meter imports for {period} yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Meter</th>
                  <th>File</th>
                  <th>Applied</th>
                  <th>Charge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{new Date(session.createdAt).toLocaleString("en-IN")}</td>
                    <td>{session.meterType.replace(/_/g, " ")}</td>
                    <td>{session.fileName || "—"}</td>
                    <td>{session.appliedRows}/{session.totalRows}</td>
                    <td>{formatCurrency(session.totalCharge)}</td>
                    <td>
                      <span className="badge">{session.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
