import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ModuleTone =
  | "primary"
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "red"
  | "slate";

const toneClasses: Record<ModuleTone, { icon: string; badge: string; stat: string }> = {
  primary: {
    icon: "bg-primary/5 text-primary border-primary/10",
    badge: "bg-primary/10 text-primary border-primary/10",
    stat: "text-primary bg-primary/5",
  },
  blue: {
    icon: "bg-blue-500/5 text-blue-600 border-blue-500/10",
    badge: "bg-blue-50 text-blue-700 border-blue-100",
    stat: "text-blue-600 bg-blue-50",
  },
  emerald: {
    icon: "bg-emerald-500/5 text-emerald-600 border-emerald-500/10",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
    stat: "text-emerald-600 bg-emerald-50",
  },
  violet: {
    icon: "bg-violet-500/5 text-violet-600 border-violet-500/10",
    badge: "bg-violet-50 text-violet-700 border-violet-100",
    stat: "text-violet-600 bg-violet-50",
  },
  amber: {
    icon: "bg-amber-500/5 text-amber-600 border-amber-500/10",
    badge: "bg-amber-50 text-amber-700 border-amber-100",
    stat: "text-amber-600 bg-amber-50",
  },
  red: {
    icon: "bg-red-500/10 text-red-600 border-red-500/10",
    badge: "bg-red-50 text-red-700 border-red-100",
    stat: "text-red-600 bg-red-50",
  },
  slate: {
    icon: "bg-slate-500/5 text-slate-700 border-slate-200",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
    stat: "text-slate-700 bg-slate-50",
  },
};

interface ModulePageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: ModuleTone;
  meta?: string;
  actions?: ReactNode;
}

export function ModulePageHeader({
  icon: Icon,
  title,
  description,
  tone = "primary",
  meta,
  actions,
}: ModulePageHeaderProps) {
  const classes = toneClasses[tone];

  return (
    <div className="flex flex-col gap-5 rounded-[1.5rem] border border-border/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:bg-[#1E1E1E]">
      <div className="flex min-w-0 items-center gap-4">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm sm:size-14", classes.icon)}>
          <Icon className="size-6 sm:size-7" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-text-primary sm:text-2xl">
              {title}
            </h1>
            {meta && (
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", classes.badge)}>
                {meta}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium leading-relaxed text-text-secondary sm:text-sm">
            {description}
          </p>
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 overflow-x-auto pb-1 sm:justify-end sm:overflow-visible sm:pb-0">
          {actions}
        </div>
      )}
    </div>
  );
}

interface ModuleStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: ModuleTone;
}

export function ModuleStatCard({ icon: Icon, label, value, tone = "primary" }: ModuleStatCardProps) {
  const classes = toneClasses[tone];

  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md dark:bg-[#1E1E1E]">
      <div className="flex items-center justify-between gap-3">
        <div className={cn("flex size-10 items-center justify-center rounded-xl", classes.stat)}>
          <Icon className="size-5" aria-hidden />
        </div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-text-secondary">
        {label}
      </p>
    </div>
  );
}

interface ModuleEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: ModuleTone;
}

export function ModuleEmptyState({
  icon: Icon,
  title,
  description,
  tone = "primary",
}: ModuleEmptyStateProps) {
  const classes = toneClasses[tone];

  return (
    <div className="rounded-[1.5rem] border-2 border-dashed border-border/70 bg-surface/35 px-6 py-20 text-center">
      <div className={cn("mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border bg-white shadow-sm", classes.icon)}>
        <Icon className="size-7" aria-hidden />
      </div>
      <p className="text-base font-bold text-text-primary">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-text-secondary">{description}</p>}
    </div>
  );
}

interface ModuleSectionTitleProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function ModuleSectionTitle({ title, description, actions }: ModuleSectionTitleProps) {
  return (
    <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-bold tracking-tight text-text-primary sm:text-lg">{title}</h2>
        {description && <p className="mt-1 text-xs font-medium text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
