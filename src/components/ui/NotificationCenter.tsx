"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Receipt,
  AlertTriangle,
  Megaphone,
  Vote,
  UserCheck,
  Clock,
  X,
} from "lucide-react";
import { LIVE_FAST_INTERVAL_MS } from "@/lib/live-refresh";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  bill_due: { icon: Clock, color: "text-warning bg-warning-bg" },
  bill_paid: { icon: Receipt, color: "text-success bg-success-bg" },
  complaint_update: { icon: AlertTriangle, color: "text-orange-600 bg-orange-50" },
  notice_new: { icon: Megaphone, color: "text-primary bg-blue-50" },
  poll_new: { icon: Vote, color: "text-purple-600 bg-purple-50" },
  visitor_entry: { icon: UserCheck, color: "text-cyan-600 bg-cyan-50" },
  late_fee: { icon: Receipt, color: "text-danger bg-danger-bg" },
  reminder: { icon: Bell, color: "text-warning bg-warning-bg" },
  admin_request: { icon: Bell, color: "text-primary bg-blue-50" },
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationCenter({ compact = false }: { compact?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await fetch("/api/notifications?limit=30");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silent
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Delay initial fetch by 2s so it doesn't compete with critical dashboard data
    const initialTimer = setTimeout(() => fetchNotifications(false), 2000);
    const interval = setInterval(() => fetchNotifications(true), LIVE_FAST_INTERVAL_MS);
    const refreshOnFocus = () => fetchNotifications(true);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") fetchNotifications(true);
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead(n.id);
    if (n.link) {
      setOpen(false);
      window.location.href = n.link;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative transition-colors ${
          compact
            ? "flex h-full w-full items-center justify-center"
            : "rounded-lg p-2 hover:bg-surface"
        }`}
        id="notification-bell"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-[72px] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[360px] max-h-[480px] bg-white rounded-xl shadow-xl border border-border z-50 overflow-hidden dark:bg-slate-900"
          style={{ animation: "slideUp 0.15s ease" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-border/50"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[400px]">
            {loading && !notifications.length ? (
              <div className="flex justify-center py-8">
                <div className="spinner" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-sm text-text-secondary">
                <Bell className="w-8 h-8 mx-auto mb-2 text-border" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const config = typeConfig[n.type] || typeConfig.reminder;
                const Icon = config.icon;
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleClick(n);
                    }}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-surface/80 transition-colors border-b border-border/50 last:border-b-0 ${
                      !n.isRead ? "bg-blue-50/40 dark:bg-blue-500/10" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!n.isRead ? "font-semibold" : "font-medium"}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-text-secondary/70 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                        className="p-1 rounded hover:bg-border/50 shrink-0 self-start"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3 text-text-secondary" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
