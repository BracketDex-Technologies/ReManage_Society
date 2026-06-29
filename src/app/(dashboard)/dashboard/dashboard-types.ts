export interface DashboardData {
  totalCollected: number;
  pendingAmount: number;
  totalExpenses: number;
  totalMembers: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  totalFlats: number;
  period: string;
  financeScope?: string;
  financeYears?: string[];
  fundBalance: number;
  openComplaints: number;
  visitorsToday: number;
  activePolls: number;
  recentActivity?: Array<{
    id: string;
    flatNumber: string;
    ownerName: string;
    amount: number;
    status: string;
    paidVia?: string | null;
    paidAt?: string | null;
    updatedAt: string;
  }>;
}

export interface AdminAnalyticsData {
  monthlyTrend: Array<{ period: string; label: string; collected: number; pending: number; expenses: number; collectionRate: number }>;
  expenseCategories: Array<{ category: string; amount: number }>;
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  aging: { current: number; days30: number; days60: number; days90Plus: number };
  topDefaulters: Array<{ flatNumber: string; ownerName: string; pending: number; billCount: number }>;
}

export interface MyBillsData {
  stats: { totalPending: number; totalPaid: number };
}
