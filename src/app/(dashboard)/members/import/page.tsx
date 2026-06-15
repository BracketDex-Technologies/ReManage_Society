"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Upload, Download, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";

export default function ImportMembersPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFile = (file: File) => {
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        setAllRows(data);
        setPreview(data.slice(0, 5));
      },
      error: () => {
        toast.error("Failed to parse file");
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (allRows.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: allRows }),
      });

      const data = await res.json();

      if (res.ok) {
        const msg = `${data.imported} flats imported successfully${data.skipped > 0 ? ` (${data.skipped} skipped)` : ""}`;
        toast.success(msg);
        router.push("/members");
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv =
      "flat_number,wing,floor,owner_name,tenant_name,contact,email,vehicle_number\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="p-2 rounded-lg hover:bg-surface transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="page-title">Bulk Import Members</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Import flats from CSV or Excel file
          </p>
        </div>
      </div>

      <div className="card mb-4">
        <button onClick={downloadTemplate} className="btn btn-secondary btn-sm mb-4">
          <Download className="w-4 h-4" />
          Download sample template CSV
        </button>

        <div
          className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileSpreadsheet className="w-12 h-12 text-text-secondary mx-auto mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">
            {fileName || "Drag & drop your .csv file here"}
          </p>
          <p className="text-xs text-text-secondary">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm text-text-primary mb-3">
            Preview (first 5 rows of {allRows.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="table text-xs">
              <thead>
                <tr>
                  {Object.keys(preview[0]).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>{val || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-border">
            <button
              onClick={handleImport}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" />
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import {allRows.length} Members
                </>
              )}
            </button>
            <button
              onClick={() => {
                setPreview([]);
                setAllRows([]);
                setFileName("");
              }}
              className="btn btn-secondary"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
