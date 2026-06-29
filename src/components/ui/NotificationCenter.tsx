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
  Sparkles,
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

const typeConfig: Record<string, { icon: typeof Bell; color: string; accent: string }> = {
  bill_due: { icon: Clock, color: "text-warning-text bg-warning-bg", accent: "bg-warning" },
  bill_paid: { icon: Receipt, color: "text-success-text bg-success-bg", accent: "bg-success" },
  complaint_update: { icon: AlertTriangle, color: "text-orange-700 bg-orange-50 dark:text-orange-200 dark:bg-orange-500/15", accent: "bg-orange-500" },
  notice_new: { icon: Megaphone, color: "text-primary bg-blaze-orange-50 dark:bg-blaze-orange-500/15", accent: "bg-primary" },
  poll_new: { icon: Vote, color: "text-violet-700 bg-violet-50 dark:text-violet-200 dark:bg-violet-500/15", accent: "bg-violet-500" },
  visitor_entry: { icon: UserCheck, color: "text-cyan-700 bg-cyan-50 dark:text-cyan-200 dark:bg-cyan-500/15", accent: "bg-cyan-500" },
  late_fee: { icon: Receipt, color: "text-danger-text bg-danger-bg", accent: "bg-danger" },
  reminder: { icon: Bell, color: "text-warning-text bg-warning-bg", accent: "bg-warning" },
  admin_request: { icon: Bell, color: "text-primary bg-blaze-orange-50 dark:bg-blaze-orange-500/15", accent: "bg-primary" },
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

  const visibleUnreadCount = unreadCount > 99 ? "99+" : String(unreadCount);
  const latestNotification = notifications[0];

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative transition-all duration-200 ${
          compact
            ? `flex h-full w-full items-center justify-center rounded-xl ${open ? "bg-[#FFEEE5] text-primary dark:bg-[#331100]" : "text-text-secondary"}`
            : `rounded-xl border border-transparent p-2 hover:border-[#FF5400]/20 hover:bg-[#FFEEE5] ${open ? "border-[#FF5400]/30 bg-[#FFEEE5] text-primary shadow-sm dark:bg-[#331100]" : "text-text-secondary"}`
        }`}
        id="notification-bell"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className={`h-4 w-4 ${open || unreadCount > 0 ? "text-primary" : "text-text-secondary"}`} />
        {unreadCount > 0 && (
          <span
            className={
              compact
                ? "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#EF4444] px-1 text-[9px] font-black leading-none text-white shadow-[0_6px_14px_rgba(239,68,68,0.35)] dark:border-[#222222]"
                : "absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#EF4444] px-1.5 text-[10px] font-black leading-none text-white shadow-[0_6px_14px_rgba(239,68,68,0.35)] dark:border-[#171717]"
            }
          >
            {visibleUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed left-3 right-3 top-[72px] z-50 max-h-[min(560px,calc(100vh-96px))] overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-[0_24px_70px_rgba(51,51,51,0.18)] dark:border-[#404040] dark:bg-[#171717] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[400px]"
          style={{ animation: "slideUp 0.15s ease" }}>
          <div className="border-b border-[#E6E6E6] bg-[#FEFDDF] px-4 py-3 dark:border-[#404040] dark:bg-[#222222]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF5400] text-white shadow-sm">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-text-primary">Notifications</h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-text-secondary">
                      {unreadCount > 0 ? `${visibleUnreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up"}
                    </p>
                  </div>
                </div>
                {latestNotification && (
                  <p className="mt-2 truncate text-[11px] text-text-secondary">
                    Latest: <span className="font-semibold text-text-primary">{latestNotification.title}</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#EF4444] px-2 py-1 text-[10px] font-black leading-none text-white">
                    {visibleUnreadCount}
                  </span>
                )}
                <button
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white text-text-secondary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#404040] dark:bg-[#171717]"
                  title="Mark all read"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white text-text-secondary transition-colors hover:text-text-primary dark:border-[#404040] dark:bg-[#171717]"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-[min(444px,calc(100vh-218px))] overflow-y-auto bg-white dark:bg-[#171717]">
            {loading && !notifications.length ? (
              <div className="flex justify-center py-10">
                <div className="spinner" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-text-secondary">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEFDDF] text-primary dark:bg-[#222222]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="font-bold text-text-primary">No notifications yet</p>
                <p className="mt-1 text-xs">Important society updates will appear here.</p>
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
                    className={`group relative flex w-full gap-3 border-b border-[#E6E6E6]/70 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-[#FEFDDF]/70 dark:border-[#404040]/70 dark:hover:bg-[#222222] ${
                      !n.isRead ? "bg-[#FFEEE5]/55 dark:bg-[#331100]/60" : "bg-white dark:bg-[#171717]"
                    }`}
                  >
                    {!n.isRead && (
                      <span className={`absolute left-0 top-3.5 h-[calc(100%-28px)] w-1 rounded-r-full ${config.accent}`} />
                    )}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${config.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className={`min-w-0 flex-1 truncate text-sm leading-5 text-text-primary ${!n.isRead ? "font-black" : "font-semibold"}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.12)]" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-text-secondary">
                        {n.message}
                      </p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary/70">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-xl border border-[#E6E6E6] bg-white text-text-secondary opacity-100 transition-colors hover:text-primary dark:border-[#404040] dark:bg-[#222222] md:opacity-0 md:group-hover:opacity-100"
                        title="Mark as read"
                        aria-label={`Mark ${n.title} as read`}
                      >
                        <Check className="h-3.5 w-3.5" />
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
