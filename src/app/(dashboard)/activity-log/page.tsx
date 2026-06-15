"use client";

import { useEffect, useState, useCallback } from "react";
import { History, Filter, User, Calendar, ArrowRight } from "lucide-react";

interface ActivityLogEntry {
  id: string;
  userName: string;
  action: string;
  module: string;
  targetId: string | null;
  targetLabel: string | null;
  details: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-100 text-green-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-700",
  generated: "bg-purple-100 text-purple-700",
  sent: "bg-cyan-100 text-cyan-700",
  resolved: "bg-teal-100 text-teal-700",
};

const MODULE_ICONS: Record<string, string> = {
  bill: "💰",
  expense: "💸",
  complaint: "⚠️",
  notice: "📢",
  visitor: "👤",
  flat: "🏠",
  poll: "🗳️",
  meeting: "📋",
  facility: "🏛️",
  parking: "🚗",
  document: "📄",
  settings: "⚙️",
};

const MODULES = [
  "all", "bill", "expense", "complaint", "notice", "visitor",
  "flat", "poll", "meeting", "facility", "parking", "document", "settings"
];

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ module, page: String(page), limit: "50" });
      const res = await fetch(`/api/activity-log?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [module, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-primary" />
          <div>
            <h1 className="page-title">Activity Log</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Track all actions and changes across your society
            </p>
          </div>
        </div>
      </div>

      {/* Module Filter */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-text-secondary shrink-0" />
        <div className="flex gap-1 bg-white border border-border rounded-lg p-0.5">
          {MODULES.map((m) => (
            <button
              key={m}
              onClick={() => { setModule(m); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                module === m
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {m === "all" ? "All" : `${MODULE_ICONS[m] || ""} ${m.charAt(0).toUpperCase() + m.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-12">
          <History className="w-12 h-12 mx-auto mb-3 text-border" />
          <h3 className="font-semibold text-lg mb-1">No activity yet</h3>
          <p className="text-sm text-text-secondary">
            Actions will appear here as users interact with the system
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, i) => {
            const showDate = i === 0 || 
              new Date(logs[i - 1].createdAt).toDateString() !== new Date(log.createdAt).toDateString();

            return (
              <div key={log.id}>
                {showDate && (
                  <div className="flex items-center gap-2 py-2 mt-2 first:mt-0">
                    <Calendar className="w-3.5 h-3.5 text-text-secondary" />
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      {new Date(log.createdAt).toLocaleDateString("en-IN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div className="flex gap-3 py-2.5 px-4 bg-white border border-border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 text-sm">
                    {MODULE_ICONS[log.module] || "📝"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-text-secondary" />
                        <span className="text-sm font-medium">{log.userName}</span>
                      </div>
                      <span className={`badge text-[10px] ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {log.module}
                      </span>
                    </div>
                    {log.targetLabel && (
                      <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {log.targetLabel}
                      </p>
                    )}
                    {log.details && (
                      <p className="text-xs text-text-secondary/70 mt-0.5 truncate max-w-md">
                        {log.details}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-text-secondary shrink-0 self-center">
                    {formatTime(log.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <span className="flex items-center text-sm text-text-secondary px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
