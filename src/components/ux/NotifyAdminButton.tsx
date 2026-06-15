"use client";

import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface NotifyAdminButtonProps {
  category?: "flat_link" | "general";
  message?: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary";
}

export default function NotifyAdminButton({
  category = "flat_link",
  message,
  label = "Notify Admin",
  className = "",
  variant = "primary",
}: NotifyAdminButtonProps) {
  const [sending, setSending] = useState(false);

  const handleNotify = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/notifications/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category, message }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Admin notified successfully");
      } else {
        toast.error(data.error || "Could not notify admin");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const base =
    variant === "primary"
      ? "btn btn-primary !rounded-xl font-bold text-sm shadow-md shadow-primary/10"
      : "btn btn-secondary !rounded-xl font-bold text-sm";

  return (
    <button
      type="button"
      onClick={handleNotify}
      disabled={sending}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-60 ${base} ${className}`}
    >
      {sending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <BellRing className="h-4 w-4" />
      )}
      {sending ? "Sending..." : label}
    </button>
  );
}
