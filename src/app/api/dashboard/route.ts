import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentPeriod } from "@/lib/utils";
import { cached } from "@/lib/api-cache";

export async function GET() {
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
    const cacheKey = `dashboard:${societyId}:${period}`;

    const data = await cached(cacheKey, async () => {
      const [yearStr, monthStr] = period.split("-");
      const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
      const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 0, 23, 59, 59);

      const [
        society,
        billStats,
        totalMembers,
        openComplaints,
        todayVisitors,
        activePolls,
        expenseAggregate,
        incomeAggregate,
        allExpensesAggregate,
        recentBills,
      ] = await Promise.all([
        prisma.society.findUnique({
          where: { id: societyId },
          select: { openingBalance: true, totalFlats: true },
        }),
        prisma.maintenanceBill.groupBy({
          by: ["status"],
          where: {
            societyId,
            period,
            flat: { users: { some: { role: { in: ["member", "tenant"] } } } },
          },
          _sum: { amount: true, paidAmount: true },
          _count: { id: true },
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
          where: { societyId, approvalStatus: "approved", paidOn: { gte: startDate, lte: endDate } },
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
          where: {
            societyId,
            period,
            flat: { users: { some: { role: { in: ["member", "tenant"] } } } },
          },
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

      billStats.forEach((stat) => {
        const collected = stat._sum?.paidAmount || 0;
        const total = stat._sum?.amount || 0;
        totalCollected += collected;
        pendingAmount += total - collected;
        if (stat.status === "paid") paidCount = stat._count?.id || 0;
        else if (stat.status === "partial") partialCount = stat._count?.id || 0;
        else if (stat.status === "pending") pendingCount = stat._count?.id || 0;
      });

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
