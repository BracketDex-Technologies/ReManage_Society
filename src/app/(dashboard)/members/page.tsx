"use client";

import { useI18n } from "@/lib/i18n";
import { useTranslatedToast } from "@/lib/use-translated-toast";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Upload, Search, Pencil, Trash2, MessageSquare, Download, X } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import type { FlatType } from "@/types";

type StatusFilter = "" | "active" | "inactive";
type OccupancyFilter = "" | "owner" | "tenant" | "vacant";

interface MemberStats {
  total: number;
  active: number;
  vacant: number;
  tenantOccupied: number;
}

export default function MembersPage() {
  const { t } = useI18n();
  const toastT = useTranslatedToast();
  const [members, setMembers] = useState<FlatType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>("");
  const [wings, setWings] = useState<string[]>([]);
  const [stats, setStats] = useState<MemberStats>({ total: 0, active: 0, vacant: 0, tenantOccupied: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<FlatType | null>(null);

  const hasFilters = Boolean(search || wingFilter || statusFilter || occupancyFilter);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (wingFilter) params.set("wing", wingFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (occupancyFilter) params.set("occupancy", occupancyFilter);
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());

    try {
      const res = await fetch(`/api/members?${params}`);
      const data = await res.json();
      setMembers(data.members || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 1);
      if (data.wings) setWings(data.wings);
      if (data.stats) setStats(data.stats);
    } catch {
      toastT.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [search, wingFilter, statusFilter, occupancyFilter, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  const resetFilters = () => {
    setSearch("");
    setWingFilter("");
    setStatusFilter("");
    setOccupancyFilter("");
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/members/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toastT.success(`Flat ${deleteTarget.flatNumber} removed`);
        fetchMembers();
      } else {
        toastT.error("Failed to delete member");
      }
    } catch {
      toastT.error("Something went wrong");
    }
    setDeleteTarget(null);
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams({ limit: "1000" });
      if (search) params.set("search", search);
      if (wingFilter) params.set("wing", wingFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (occupancyFilter) params.set("occupancy", occupancyFilter);

      const res = await fetch(`/api/members?${params}`);
      const data = await res.json();
      if (!data.members?.length) return toastT.error("No members to export");

      const headers = ["Flat No.", "Wing", "Owner Name", "Tenant Name", "Contact", "Email", "Vehicle Number", "Status"];
      const csvContent = [
        headers.join(","),
        ...data.members.map(
          (m: {
            flatNumber: string;
            wing?: string;
            ownerName: string;
            tenantName?: string;
            contact: string;
            email?: string;
            vehicleNumber?: string;
            isActive: boolean;
          }) =>
            [m.flatNumber, m.wing || "", m.ownerName, m.tenantName || "", m.contact, m.email || "", m.vehicleNumber || "", m.isActive ? "Active" : "Inactive"]
              .map((v) => `"${v}"`)
              .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `society_members_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      toastT.success("Export successful");
    } catch {
      toastT.error("Failed to export");
    }
  };

  const occupancyLabel = (member: FlatType & { currentOccupant?: string }) => {
    const occ = (member as FlatType & { currentOccupant?: string }).currentOccupant;
    if (occ === "tenant") return "Tenant";
    if (occ === "vacant") return "Vacant";
    return "Owner";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Residents")}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {stats.total} flats · {stats.active} active · {stats.vacant} vacant
          </p>
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
            Add Resident
          </Link>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total flats", value: stats.total },
            { label: "Active", value: stats.active },
            { label: "Vacant", value: stats.vacant },
            { label: "Tenant occupied", value: stats.tenantOccupied },
          ].map((item) => (
            <div key={item.label} className="stat-card !p-3 text-center">
              <p className="text-xl font-black text-text-primary">{item.value}</p>
              <p className="text-[10px] font-semibold text-text-secondary mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-4 !p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search by name, flat number, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { id: "", label: "All status" },
            { id: "active", label: "Active" },
            { id: "inactive", label: "Inactive" },
          ] as { id: StatusFilter; label: string }[]).map((opt) => (
            <button
              key={opt.id || "all-status"}
              type="button"
              onClick={() => {
                setStatusFilter(opt.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                statusFilter === opt.id ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { id: "", label: "All occupancy" },
            { id: "owner", label: "Owner" },
            { id: "tenant", label: "Tenant" },
            { id: "vacant", label: "Vacant" },
          ] as { id: OccupancyFilter; label: string }[]).map((opt) => (
            <button
              key={opt.id || "all-occ"}
              type="button"
              onClick={() => {
                setOccupancyFilter(opt.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                occupancyFilter === opt.id ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {wings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setWingFilter("");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                !wingFilter ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              All wings
            </button>
            {wings.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  setWingFilter(w);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  wingFilter === w ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                Wing {w}
              </button>
            ))}
          </div>
        )}

        {hasFilters && (
          <button type="button" onClick={resetFilters} className="btn btn-secondary btn-sm">
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : members.length === 0 ? (
        <div className="card">
          {hasFilters ? (
            <div className="text-center py-10">
              <Search className="w-8 h-8 mx-auto text-text-tertiary opacity-40 mb-3" />
              <p className="text-sm font-medium text-text-primary">No residents match your filters</p>
              <button type="button" onClick={resetFilters} className="btn btn-secondary btn-sm mt-3">
                Clear filters
              </button>
            </div>
          ) : (
            <EmptyState
              title="No residents added yet"
              description="Add your first flat or import from Excel to get started."
              actionLabel="+ Add Resident"
              actionHref="/members/add"
              secondaryLabel="Import CSV"
              secondaryHref="/members/import"
            />
          )}
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="table-wrapper !border-0 !rounded-none">
            <table className="table">
              <thead>
                <tr>
                  <th>Flat No.</th>
                  <th>Name & Role</th>
                  <th className="hidden sm:table-cell">Contact</th>
                  <th className="hidden md:table-cell">Wing</th>
                  <th>Occupancy</th>
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
                        <p className="font-medium">{m.ownerName || "—"}</p>
                        {m.tenantName && <p className="text-xs text-text-secondary">Tenant: {m.tenantName}</p>}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-text-secondary">{m.contact || "—"}</td>
                    <td className="hidden md:table-cell text-text-secondary">{m.wing || "—"}</td>
                    <td>
                      <span className="text-xs font-semibold text-text-secondary">{occupancyLabel(m)}</span>
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
                        {m.contact && (
                          <button
                            onClick={() => window.open(`https://wa.me/91${m.contact}`, "_blank")}
                            className="p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-success"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
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

          <div className="px-4 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="residents"
            />
          </div>
        </div>
      )}

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
