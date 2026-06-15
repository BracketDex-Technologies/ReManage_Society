"use client";

import Link from "next/link";
import { AlertTriangle, Package, Phone, Shield, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import PageState from "@/components/ux/PageState";
import { shapeGuardDashboardMetrics } from "../dashboard-shaping";
import type { DashboardData } from "../dashboard-types";

export default function GuardDashboard({
  data,
  loading,
}: {
  data: DashboardData | null;
  loading: boolean;
}) {
  const { t } = useI18n();
  const metrics = shapeGuardDashboardMetrics(data);

  if (loading && !data) {
    return <PageState variant="loading" title={t("Loading gate console")} description={t("Fetching visitor and parcel activity.")} />;
  }

  const cards = [
    { href: "/visitors", label: t("Active visitors"), value: String(metrics.visitorsToday), icon: Shield, tone: "bg-blue-600" },
    { href: "/packages", label: t("Parcel desk"), value: t("Open desk"), icon: Package, tone: "bg-emerald-600" },
    { href: "/emergency", label: t("SOS desk"), value: t("Raise alert"), icon: Phone, tone: "bg-red-600" },
    { href: "/notices", label: t("Gate notices"), value: String(metrics.activePolls), icon: AlertTriangle, tone: "bg-amber-600" },
  ];

  return (
    <div className="-m-3 min-h-full bg-[#FFFBEB] p-3 dark:bg-[#141414] sm:p-4 lg:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-[1.75rem] border border-[#FED7AA] bg-white p-5 shadow-sm dark:border-[#303030] dark:bg-[#1E1E1E]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{t("Security persona")}</p>
              <h1 className="text-2xl font-black text-text-primary">{t("Gate console")}</h1>
            </div>
          </div>
          <p className="text-sm font-medium text-text-secondary">{t("Large-touch shortcuts for visitor logging, parcel handover, and SOS escalation.")}</p>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group min-h-[120px] rounded-[1.5rem] border border-[#FED7AA] bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-[#303030] dark:bg-[#1E1E1E]"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white ${card.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-text-secondary">{card.label}</p>
                <p className="mt-1 text-2xl font-black text-text-primary">{card.value}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
