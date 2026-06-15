"use client";

import { AlertCircle } from "lucide-react";
import { useUser } from "@/lib/user-context";
import NotifyAdminButton from "@/components/ux/NotifyAdminButton";

export default function FlatLinkBanner() {
  const { user, loaded } = useUser();

  if (!loaded) return null;
  if (user.role !== "member" && user.role !== "tenant") return null;
  if (user.flatNumber && !user.noFlatLinked) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-950 dark:text-amber-100">
              Flat not linked to your account
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
              Bills, visitors, and staff features need your flat assigned. Tap below to alert the committee.
            </p>
          </div>
        </div>
        <NotifyAdminButton
          category="flat_link"
          label="Notify Admin"
          className="w-full sm:w-auto shrink-0"
        />
      </div>
    </div>
  );
}
