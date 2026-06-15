"use client";

import Link from "next/link";
import { BarChart3, PiggyBank, Receipt, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import PageState from "@/components/ux/PageState";
import { shapeTreasurerSnapshot } from "../dashboard-shaping";
import type { AdminAnalyticsData, DashboardData } from "../dashboard-types";

export default function TreasurerDashboard({
  data,
  analytics,
  loading,
}: {
  data: DashboardData | null;
  analytics: AdminAnalyticsData | null;
  loading: boolean;
}) {
  const { t } = useI18n();
  const snapshot = shapeTreasurerSnapshot(data);
  const topDefaulters = analytics?.topDefaulters?.slice(0, 3) ?? [];

  if (loading && !data) {
    return <PageState variant="loading" title={t("Loading finance desk")} description={t("Fetching collections and fund position.")} />;
  }

  return (
    <div className="-m-3 min-h-full bg-[#FFFBEB] p-3 dark:bg-[#141414] sm:p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-[1.75rem] border border-[#FED7AA] bg-white p-5 dark:border-[#303030] dark:bg-[#1E1E1E]">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{t("Treasurer persona")}</p>
          <h1 className="mt-1 text-3xl font-black text-text-primary">{t("Finance snapshot")}</h1>
          <p className="mt-2 text-sm text-text-secondary">{snapshot.period}</p>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t("Collected"), value: formatCurrency(snapshot.collected), icon: Receipt, href: "/maintenance" },
            { label: t("Pending"), value: formatCurrency(snapshot.pending), icon: Wallet, href: "/maintenance" },
            { label: t("Expenses"), value: formatCurrency(snapshot.expenses), icon: BarChart3, href: "/expenses" },
            { label: t("Fund balance"), value: formatCurrency(snapshot.fundBalance), icon: PiggyBank, href: "/funds" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="rounded-2xl border border-[#FED7AA] bg-white p-4 dark:border-[#303030] dark:bg-[#1E1E1E]">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-3 text-xs font-bold text-text-secondary">{item.label}</p>
                <p className="mt-1 text-xl font-black text-text-primary">{item.value}</p>
              </Link>
            );
          })}
        </div>

        <section className="rounded-[1.75rem] border border-[#FED7AA] bg-white p-5 dark:border-[#303030] dark:bg-[#1E1E1E]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-text-primary">{t("Collection rate")}</h2>
            <span className="text-2xl font-black text-primary">{snapshot.collectionRate}%</span>
          </div>
          {topDefaulters.length > 0 ? (
            <div className="mt-4 space-y-2">
              {topDefaulters.map((item) => (
                <Link key={item.flatNumber} href="/maintenance" className="flex items-center justify-between rounded-xl bg-surface px-3 py-2">
                  <span className="text-sm font-bold">{item.flatNumber} · {item.ownerName}</span>
                  <span className="text-sm font-black text-primary">{formatCurrency(item.pending)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <PageState variant="empty" title={t("No defaulters flagged")} description={t("Top overdue flats will appear here once billing data is available.")} />
          )}
        </section>
      </div>
    </div>
  );
}
