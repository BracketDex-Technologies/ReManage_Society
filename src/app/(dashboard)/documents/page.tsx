"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useEffect, useState, useCallback } from "react";
import { FolderOpen, Plus, FileText, Eye, Trash2, Shield, Settings, File, X } from "lucide-react";
import { useAppDialog } from "@/components/ui/AppDialogProvider";
import { getAuthHeaders } from "@/lib/client-session";

interface Document {
  id: string;
  title: string;
  category: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  uploadedBy: string;
  createdAt: string;
}

const categoryConfig: Record<string, { icon: React.ComponentType<{className?: string}>; color: string; label: string }> = {
  bylaws: { icon: Shield, color: "text-blue-700 bg-blue-100", label: "Bylaws & Rules" },
  noc: { icon: FileText, color: "text-green-700 bg-green-100", label: "NOCs" },
  minutes: { icon: File, color: "text-purple-700 bg-purple-100", label: "Meeting Minutes" },
  financial: { icon: Settings, color: "text-orange-700 bg-orange-100", label: "Financial" },
  general: { icon: FolderOpen, color: "text-gray-700 bg-gray-100", label: "General" }
};

export default function DocumentsPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const { confirm } = useAppDialog();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [form, setForm] = useState({ title: "", category: "general" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDocuments = useCallback(() => {
    setLoading(true);
    fetch("/api/documents", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => setDocuments(d.documents || []))
      .catch(() => toastT.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3_000_000) {
        toastT.error("Document must be under 3 MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const isImagePreview = (doc: Document) => doc.fileUrl.startsWith("data:image") || /\.(png|jpe?g|webp|gif)$/i.test(doc.fileName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toastT.error("Please select a file first");
      return;
    }
    
    setSaving(true);
    try {
      const upload = new FormData();
      upload.set("title", form.title);
      upload.set("category", form.category);
      upload.set("file", selectedFile);
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: getAuthHeaders(),
        body: upload,
      });
      if (res.ok) {
        toastT.success("Document uploaded");
        setShowForm(false);
        setForm({ title: "", category: "general" });
        setSelectedFile(null);
        fetchDocuments();
      } else {
        const d = await res.json();
        toastT.error(d.error || "Failed");
      }
    } catch { toastT.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete Document",
      message: "Delete this document from the repository? This action cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    toastT.success("Document deleted");
    fetchDocuments();
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  // Group by category
  const grouped = documents.reduce<Record<string, Document[]>>((acc, d) => {
    (acc[d.category] = acc[d.category] || []).push(d);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title">{t("Document Repository")}</h1>
            <p className="text-sm text-text-secondary mt-0.5">{documents.length} {t("documents securely stored")}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : documents.length === 0 ? (
        <div className="card text-center py-12 text-text-secondary">
          No documents uploaded yet. Keep your society rules, NOCs, and meeting minutes here.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => {
            const config = categoryConfig[category] || categoryConfig.general;
            const Icon = config.icon;
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h2 className="font-semibold text-sm text-text-primary">{config.label}</h2>
                  <span className="text-xs text-text-secondary">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((doc) => (
                    <div key={doc.id} className="card card-hover flex flex-col justify-between h-full !p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 shrink-0 rounded-lg bg-surface flex items-center justify-center border border-border">
                            <FileText className="w-5 h-5 text-text-secondary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm line-clamp-2" title={doc.title}>{doc.title}</h3>
                            <p className="text-xs text-text-secondary truncate mt-0.5" title={doc.fileName}>{doc.fileName}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3 mt-3">
                        <div className="text-[10px] text-text-secondary">
                          <p>{formatSize(doc.fileSize)}</p>
                          <p>{new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setPreviewDoc(doc)} className="btn btn-secondary btn-sm !py-1 !px-2" title="Preview Document">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(doc.id)} className="btn btn-secondary btn-sm !p-1 text-danger" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showForm && (
        <div className="modal-overlay z-[100] p-3 sm:p-4" onClick={() => setShowForm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-document-title"
            className="modal-content !m-0 flex min-h-0 !max-h-[calc(100dvh-1.5rem)] w-full !max-w-lg flex-col overflow-hidden !rounded-2xl !p-5 sm:!max-h-[85dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
              <h3 id="upload-document-title" className="text-lg font-semibold">Upload Document</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-text-secondary hover:bg-surface" aria-label="Close upload document form">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
                <div><label className="label">Title *</label><input className="input" placeholder="e.g. Society Bylaws 2024" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                <div>
                  <label className="label">Category *</label>
                  <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {Object.entries(categoryConfig).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">File *</label>
                  <input type="file" className="input file:btn file:btn-secondary file:border-0 file:mr-4 file:py-1 file:px-3 text-sm" onChange={handleFileChange} required />
                  {selectedFile && <p className="mt-1 text-xs text-text-secondary truncate">{selectedFile.name} ({formatSize(selectedFile.size)})</p>}
                </div>
              </div>
              <div className="mt-3 flex shrink-0 justify-end gap-3 border-t border-border pt-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? <div className="spinner !w-4 !h-4 !border-white/30 !border-t-white" /> : "Upload"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] p-5 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Preview Document</h3>
                <p className="text-xs text-text-secondary mt-1">{previewDoc.title} · {previewDoc.fileName}</p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-lg hover:bg-surface text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-xl border border-border bg-surface">
              {isImagePreview(previewDoc) ? (
                <img src={previewDoc.fileUrl} alt={previewDoc.title} className="h-full w-full object-contain" />
              ) : (
                <iframe src={previewDoc.fileUrl} title={previewDoc.title} className="h-full w-full bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
