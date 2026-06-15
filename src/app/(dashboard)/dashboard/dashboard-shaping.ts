import type { DashboardData } from "./dashboard-types";

export function shapeGuardDashboardMetrics(data: DashboardData | null) {
  return {
    visitorsToday: data?.visitorsToday ?? 0,
    openComplaints: data?.openComplaints ?? 0,
    activePolls: data?.activePolls ?? 0,
  };
}

export function shapeTreasurerSnapshot(data: DashboardData | null) {
  const collected = data?.totalCollected ?? 0;
  const pending = data?.pendingAmount ?? 0;
  const total = collected + pending;

  return {
    collected,
    pending,
    expenses: data?.totalExpenses ?? 0,
    fundBalance: data?.fundBalance ?? 0,
    collectionRate: total > 0 ? Math.round((collected / total) * 100) : 0,
    period: data?.period ?? "--",
  };
}
