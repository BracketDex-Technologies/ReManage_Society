"use client";

import Link from "next/link";
import { Server, Shield, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import PageState from "@/components/ux/PageState";
import type { DashboardData } from "../dashboard-types";

export default function PlatformAdminDashboard({
  data,
  loading,
}: {
  data: DashboardData | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  if (loading && !data) {
    return <PageState variant="loading" title={t("Loading platform console")} />;
  }

  return (
    <div className="-m-3 min-h-full bg-[#FFFBEB] p-3 dark:bg-[#141414] sm:p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-[1.75rem] border border-[#FED7AA] bg-white p-5 dark:border-[#303030] dark:bg-[#1E1E1E]">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{t("Platform persona")}</p>
          <h1 className="mt-1 text-3xl font-black text-text-primary">{t("Platform health")}</h1>
        </section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/system/sessions" className="rounded-2xl border border-[#FED7AA] bg-white p-4 dark:border-[#303030] dark:bg-[#1E1E1E]">
            <Server className="h-5 w-5 text-primary" />
            <p className="mt-3 font-black text-text-primary">{t("Sessions")}</p>
          </Link>
          <div className="rounded-2xl border border-[#FED7AA] bg-white p-4 dark:border-[#303030] dark:bg-[#1E1E1E]">
            <Users className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-bold text-text-secondary">{t("Residents")}</p>
            <p className="text-2xl font-black">{data?.totalMembers ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[#FED7AA] bg-white p-4 dark:border-[#303030] dark:bg-[#1E1E1E]">
            <Shield className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-bold text-text-secondary">{t("Visitors today")}</p>
            <p className="text-2xl font-black">{data?.visitorsToday ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
