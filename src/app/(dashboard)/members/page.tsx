"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Plus, Upload, Search, Pencil, Trash2, MessageSquare, Download } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import type { FlatType } from "@/types";

export default function MembersPage() {
  const [members, setMembers] = useState<FlatType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [wings, setWings] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<FlatType | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (wingFilter) params.set("wing", wingFilter);
    params.set("page", page.toString());
    params.set("limit", "20");

    try {
      const res = await fetch(`/api/members?${params}`);
      const data = await res.json();
      setMembers(data.members || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 1);
      if (data.wings) setWings(data.wings);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [search, wingFilter, page]);

  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/members/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Flat ${deleteTarget.flatNumber} removed`);
        fetchMembers();
      } else {
        toast.error("Failed to delete member");
      }
    } catch {
      toast.error("Something went wrong");
    }
    setDeleteTarget(null);
  };

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/members?limit=1000`);
      const data = await res.json();
      if (!data.members || data.members.length === 0) return toast.error("No members to export");
      
      const headers = ["Flat No.", "Wing", "Owner Name", "Tenant Name", "Contact", "Email", "Vehicle Number", "Status"];
      const csvContent = [
        headers.join(","),
        ...data.members.map((m: { flatNumber: string; wing?: string; ownerName: string; tenantName?: string; contact: string; email?: string; vehicleNumber?: string; isActive: boolean }) => 
          [m.flatNumber, m.wing || "", m.ownerName, m.tenantName || "", m.contact, m.email || "", m.vehicleNumber || "", m.isActive ? "Active" : "Inactive"].map(v => `"${v}"`).join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `society_members_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Export successful");
    } catch {
      toast.error("Failed to export");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Members & Flats</h1>
          <p className="text-sm text-text-secondary mt-1">{total} total flats</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCsv} className="btn btn-secondary btn-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <Link href="/members/import" className="btn btn-secondary btn-sm">
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <Link href="/members/add" className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            Add Member
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search by name or flat number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="select !w-auto min-w-[140px]"
          value={wingFilter}
          onChange={(e) => {
            setWingFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Wings</option>
          {wings.map((w) => (
            <option key={w} value={w}>
              Wing {w}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : members.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No members added yet"
            description="Add your first flat or import from Excel to get started."
            actionLabel="+ Add Member"
            actionHref="/members/add"
            secondaryLabel="Import CSV"
            secondaryHref="/members/import"
          />
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Flat No.</th>
                  <th>Name & Role</th>
                  <th>Contact</th>
                  <th className="hidden md:table-cell">Wing</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.flatNumber}</td>
                    <td>
                      <div>
                        <p className="font-medium">{m.ownerName}</p>
                        {m.tenantName && (
                          <p className="text-xs text-text-secondary">
                            Tenant: {m.tenantName}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-text-secondary">{m.contact}</td>
                    <td className="hidden md:table-cell text-text-secondary">
                      {m.wing || "—"}
                    </td>
                    <td>
                      <StatusBadge status={m.isActive ? "active" : "inactive"} />
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/members/${m.id}/edit`}
                          className="p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-primary"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() =>
                            window.open(
                              `https://wa.me/91${m.contact}`,
                              "_blank"
                            )
                          }
                          className="p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-success"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-danger"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-text-secondary">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Member"
        message={`Are you sure you want to remove Flat ${deleteTarget?.flatNumber}? This action can be undone from settings.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
