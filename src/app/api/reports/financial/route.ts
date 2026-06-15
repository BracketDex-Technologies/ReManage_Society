import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { financeReportBucket } from "@/lib/finance-categories";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

// Financial reports: Income/Expense statement
const LEGACY_ROUTE = "/api/reports/financial";
const NEST_GET = "/api/v1/finance-core/reports/financial/generate";

async function legacyGET(request: Request) {
  const { error, status, session } = await requireAdmin();
  if (error) return Response.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const fiscalYear = searchParams.get("year") || "2025-26";

  const dateFilter: Record<string, unknown> = {};
  if (fromDate) dateFilter.gte = new Date(fromDate);
  if (toDate) dateFilter.lte = new Date(toDate);

  // Income: all paid bills
  const paidBills = await prisma.maintenanceBill.findMany({
    where: {
      societyId: session!.societyId,
      status: "paid",
      ...(fromDate || toDate ? { paidAt: dateFilter } : {}),
    },
    select: { amount: true, lateFee: true, gstAmount: true, paidAmount: true, period: true },
  });

  const totalMaintenance = paidBills.reduce((sum, b) => sum + (b.paidAmount || b.amount), 0);
  const totalLateFees = paidBills.reduce((sum, b) => sum + b.lateFee, 0);
  const totalGST = paidBills.reduce((sum, b) => sum + b.gstAmount, 0);

  // Expenses (approved only — pending items excluded from P&L)
  const expenses = await prisma.expense.findMany({
    where: {
      societyId: session!.societyId,
      approvalStatus: "approved",
      ...(fromDate || toDate ? { paidOn: dateFilter } : {}),
    },
    select: { amount: true, category: true, tdsAmount: true },
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalTDS = expenses.reduce((sum, e) => sum + e.tdsAmount, 0);

  // Category-wise breakdown
  const expenseByCategory: Record<string, number> = {};
  const expenseBuckets = {
    maintenanceRepair: 0,
    staff: 0,
    utilities: 0,
    events: 0,
    other: 0,
  };
  expenses.forEach((e) => {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
    expenseBuckets[financeReportBucket(e.category)] += e.amount;
  });

  // Pending collections
  const pendingBills = await prisma.maintenanceBill.aggregate({
    where: { societyId: session!.societyId, status: "pending" },
    _sum: { amount: true, lateFee: true },
    _count: true,
  });

  // Fund balances
  const funds = await prisma.fundAccount.findMany({
    where: { societyId: session!.societyId, isActive: true },
    select: { name: true, type: true, balance: true },
  });

  // Budget vs Actual
  const budgets = await prisma.budget.findMany({
    where: { societyId: session!.societyId, fiscalYear },
  });

  const totalIncome = totalMaintenance + totalLateFees;
  const netSurplus = totalIncome - totalExpenses;

  // Society opening balance
  const society = await prisma.society.findUnique({
    where: { id: session!.societyId },
    select: { openingBalance: true },
  });

  return Response.json({
    period: { from: fromDate, to: toDate, fiscalYear },
    income: {
      maintenance: totalMaintenance,
      marketplace: 0,
      other: totalLateFees,
      lateFees: totalLateFees,
      gstCollected: totalGST,
      total: totalIncome,
      totalIncome,
    },
    expenses: {
      maintenance: expenseByCategory.maintenance || 0,
      repair: expenseBuckets.maintenanceRepair,
      salary: expenseBuckets.staff,
      utilities: expenseBuckets.utilities,
      events: expenseBuckets.events,
      other: expenseBuckets.other,
      total: totalExpenses,
      tdsDeducted: totalTDS,
      byCategory: expenseByCategory,
    },
    profitOrLoss: netSurplus,
    summary: {
      netSurplus,
      openingBalance: society?.openingBalance || 0,
      closingBalance: (society?.openingBalance || 0) + netSurplus,
    },
    pendingCollections: {
      count: pendingBills._count,
      amount: (pendingBills._sum.amount || 0) + (pendingBills._sum.lateFee || 0),
    },
    funds,
    budgets: budgets.map((b: { category: string; planned: number; actual: number }) => ({
      category: b.category,
      planned: b.planned,
      actual: b.actual,
      variance: b.planned - b.actual,
      utilizationPercent: b.planned > 0 ? Math.round((b.actual / b.planned) * 100) : 0,
    })),
  });
}

export const GET = shimOrFallback({ legacyRoute: "/api/reports", nestPath: "/api/v1/finance-core/reports", method: "GET" }, legacyGET);
