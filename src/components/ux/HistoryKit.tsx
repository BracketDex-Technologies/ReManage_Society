"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatPeriodLabel } from "@/lib/history-utils";
import { ModuleSectionTitle } from "@/components/ux/ModulePageKit";
import { cn } from "@/lib/utils";

interface PeriodNavigatorProps {
  period: string;
  onChange: (period: string) => void;
  className?: string;
}

export function PeriodNavigator({ period, onChange, className }: PeriodNavigatorProps) {
  const { t } = useI18n();
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  const shift = (direction: -1 | 1) => {
    const next = new Date(date.getFullYear(), date.getMonth() + direction, 1);
    onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className={cn("flex items-center gap-1 rounded-lg border border-border bg-white px-1", className)}>
      <button
        type="button"
        onClick={() => shift(-1)}
        className="rounded p-1.5 hover:bg-surface"
        aria-label={t("Previous period")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[140px] px-2 text-center text-sm font-medium">{formatPeriodLabel(period)}</span>
      <button
        type="button"
        onClick={() => shift(1)}
        className="rounded p-1.5 hover:bg-surface"
        aria-label={t("Next period")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

interface HistoryScopeToggleProps {
  showHistory: boolean;
  onToggle: () => void;
  recentLabel?: string;
  historyLabel?: string;
  className?: string;
}

export function HistoryScopeToggle({
  showHistory,
  onToggle,
  recentLabel,
  historyLabel,
  className,
}: HistoryScopeToggleProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn("btn btn-secondary btn-sm !rounded-xl text-xs font-bold", className)}
    >
      <History className="h-4 w-4" />
      {showHistory ? (recentLabel ?? t("Recent")) : (historyLabel ?? t("Full History"))}
    </button>
  );
}

interface HistorySectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  muted?: boolean;
  children: ReactNode;
}

export function HistorySection({ title, description, actions, muted = true, children }: HistorySectionProps) {
  return (
    <section className={cn("space-y-3", muted && "opacity-95")}>
      <ModuleSectionTitle title={title} description={description} actions={actions} />
      <div className={cn(muted && "space-y-3 [&_.history-card]:bg-surface/50 [&_.history-card]:opacity-90")}>
        {children}
      </div>
    </section>
  );
}
