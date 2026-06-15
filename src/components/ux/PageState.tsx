"use client";

import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, Inbox, Loader2 } from "lucide-react";

type PageStateVariant = "loading" | "empty" | "error" | "permission-denied" | "success";

interface PageStateProps {
  variant: PageStateVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onRetry?: () => void;
}

const VARIANT_CONFIG: Record<
  PageStateVariant,
  { icon: typeof Loader2; iconClass: string; containerClass: string }
> = {
  loading: {
    icon: Loader2,
    iconClass: "animate-spin text-primary",
    containerClass: "border-primary/15 bg-primary/5",
  },
  empty: {
    icon: Inbox,
    iconClass: "text-slate-500",
    containerClass: "border-dashed border-slate-200 bg-slate-50 dark:border-[#303030] dark:bg-[#303030]/40",
  },
  error: {
    icon: AlertTriangle,
    iconClass: "text-red-600",
    containerClass: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30",
  },
  "permission-denied": {
    icon: Ban,
    iconClass: "text-amber-600",
    containerClass: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    containerClass: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30",
  },
};

export default function PageState({
  variant,
  title,
  description,
  actionLabel,
  actionHref,
  onRetry,
}: PageStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      className={`flex min-h-[220px] flex-col items-center justify-center rounded-2xl border px-6 py-10 text-center ${config.containerClass}`}
      role={variant === "loading" ? "status" : undefined}
      aria-live={variant === "loading" ? "polite" : undefined}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-[#1E1E1E]">
        <Icon className={`h-6 w-6 ${config.iconClass}`} aria-hidden />
      </div>
      <h2 className="text-lg font-black text-text-primary">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm font-medium text-text-secondary">{description}</p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20"
          >
            Try again
          </button>
        )}
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="min-h-11 inline-flex items-center rounded-xl border border-border bg-white px-4 text-sm font-bold text-text-primary dark:bg-[#1E1E1E]"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
