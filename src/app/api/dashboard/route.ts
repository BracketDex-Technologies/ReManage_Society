import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentPeriod } from "@/lib/utils";
import { cached } from "@/lib/api-cache";
import { NextRequest } from "next/server";

function yearFromPeriod(period: string | null | undefined) {
  const match = String(period || "").match(/^(\d{4})-/);
  return match?.[1] || null;
}

function yearDateRange(year: string | null) {
  if (!year) return {};
  const value = Number(year);
  return {
    gte: new Date(value, 0, 1),
    lte: new Date(value, 11, 31, 23, 59, 59),
  };
}

function billTotal(bill: { amount: number; lateFee: number; gstAmount: number; totalAmount: number | null }) {
  return bill.totalAmount ?? bill.amount + bill.lateFee + bill.gstAmount;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const societyId = session!.societyId;
    if (!societyId) {
      return Response.json({ error: "No society associated" }, { status: 403 });
    }

    const period = getCurrentPeriod();
    const requestedYear = request.nextUrl.searchParams.get("year") || "all";
    const selectedYear = /^\d{4}$/.test(requestedYear) ? requestedYear : null;
    const billWhere = {
      societyId,
      ...(selectedYear ? { period: { startsWith: `${selectedYear}-` } } : {}),
    };
    const expenseDateRange = yearDateRange(selectedYear);
    const expenseWhere = {
      societyId,
      approvalStatus: "approved",
      ...(selectedYear ? { paidOn: expenseDateRange } : {}),
    };
    const cacheKey = `dashboard:${societyId}:${requestedYear}:${period}`;

    const data = await cached(cacheKey, async () => {
      const [
        society,
        bills,
        totalMembers,
        openComplaints,
        todayVisitors,
        activePolls,
        expenseAggregate,
        incomeAggregate,
        allExpensesAggregate,
        recentBills,
        billPeriods,
        expenseDates,
      ] = await Promise.all([
        prisma.society.findUnique({
          where: { id: societyId },
          select: { openingBalance: true, totalFlats: true },
        }),
        prisma.maintenanceBill.findMany({
          where: billWhere,
          select: {
            amount: true,
            lateFee: true,
            gstAmount: true,
            totalAmount: true,
            paidAmount: true,
            status: true,
          },
        }),
        prisma.flat.count({
          where: {
            societyId,
            isActive: true,
            users: { some: { role: { in: ["member", "tenant"] } } },
          },
        }),
        prisma.complaint.count({
          where: { societyId, status: { in: ["open", "in_progress"] } },
        }),
        prisma.visitor.count({
          where: {
            societyId,
            entryTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        prisma.poll.count({ where: { societyId, status: "active" } }),
        prisma.expense.aggregate({
          where: expenseWhere,
          _sum: { amount: true },
        }),
        prisma.maintenanceBill.aggregate({
          where: { societyId, status: { in: ["paid", "partial"] } },
          _sum: { paidAmount: true },
        }),
        prisma.expense.aggregate({
          where: { societyId, approvalStatus: "approved" },
          _sum: { amount: true },
        }),
        prisma.maintenanceBill.findMany({
          where: billWhere,
          include: {
            flat: {
              select: {
                flatNumber: true,
                ownerName: true,
                users: {
                  where: { role: { in: ["member", "tenant"] } },
                  select: { name: true },
                },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        }),
        prisma.maintenanceBill.findMany({
          where: { societyId },
          select: { period: true },
          distinct: ["period"],
        }),
        prisma.expense.findMany({
          where: { societyId, approvalStatus: "approved" },
          select: { paidOn: true },
        }),
      ]);

      const totalExpenses = expenseAggregate._sum.amount || 0;
      const totalIncome = incomeAggregate._sum.paidAmount || 0;
      const totalAllExpenses = allExpensesAggregate._sum.amount || 0;
      const fundBalance =
        (society?.openingBalance || 0) + totalIncome - totalAllExpenses;

      const recentActivity = recentBills.map((b) => ({
        id: b.id,
        flatNumber: b.flat?.flatNumber || "—",
        ownerName: b.flat?.ownerName || b.flat?.users?.[0]?.name || "—",
        amount: b.totalAmount || b.amount,
        status: b.status,
        paidVia: b.paidVia,
        paidAt: b.paidAt?.toISOString() || null,
        updatedAt: b.updatedAt.toISOString(),
      }));

      let totalCollected = 0;
      let pendingAmount = 0;
      let paidCount = 0;
      let partialCount = 0;
      let pendingCount = 0;

      bills.forEach((bill) => {
        const total = billTotal(bill);
        const collected = bill.paidAmount || 0;
        totalCollected += collected;
        pendingAmount += Math.max(0, total - collected);
        if (bill.status === "paid") paidCount += 1;
        else if (bill.status === "partial") partialCount += 1;
        else if (bill.status === "pending") pendingCount += 1;
      });

      const billYears = billPeriods.map((item) => yearFromPeriod(item.period)).filter(Boolean) as string[];
      const expenseYears = expenseDates.map((item) => String(item.paidOn.getFullYear()));
      const financeYears = Array.from(new Set([...billYears, ...expenseYears])).sort((a, b) => Number(b) - Number(a));

      return {
        totalCollected,
        pendingAmount,
        totalExpenses,
        totalMembers,
        paidCount,
        partialCount,
        pendingCount,
        totalFlats: totalMembers,
        recentActivity,
        period,
        financeScope: selectedYear || "all",
        financeYears,
        fundBalance,
        openComplaints,
        visitorsToday: todayVisitors,
        activePolls,
      };
    }, 30_000);

    return Response.json(data);
  } catch (error: unknown) {
    console.error("Dashboard API error:", error);
    return Response.json({ error: "Unable to load dashboard data" }, { status: 503 });
  }
}
