import { calculateSocietyPortalStats } from "@/lib/portal-admin";
import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { response } = await requirePortalSession();
  if (response) return response;

  const societies = await prisma.society.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      joinCode: true,
      address: true,
      city: true,
      pincode: true,
      openingBalance: true,
      planTier: true,
      subscriptionEnd: true,
      accessDisabledAt: true,
      accessDisableReason: true,
      createdAt: true,
      users: {
        where: { role: "chairman" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      bills: {
        select: {
          amount: true,
          lateFee: true,
          gstAmount: true,
          totalAmount: true,
          paidAmount: true,
        },
      },
      expenses: {
        where: { approvalStatus: "approved" },
        select: { amount: true },
      },
      _count: {
        select: {
          flats: true,
          users: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = societies.map((society) => {
    const stats = calculateSocietyPortalStats({
      openingBalance: society.openingBalance || 0,
      bills: society.bills,
      expenses: society.expenses,
    });

    return {
      id: society.id,
      name: society.name,
      joinCode: society.joinCode,
      address: society.address,
      city: society.city,
      pincode: society.pincode,
      planTier: society.planTier,
      subscriptionEnd: society.subscriptionEnd?.toISOString() || null,
      accessDisabledAt: society.accessDisabledAt?.toISOString() || null,
      accessDisableReason: society.accessDisableReason,
      createdAt: society.createdAt.toISOString(),
      chairman: society.users[0] || null,
      totalFlats: society._count.flats,
      totalUsers: society._count.users,
      stats,
    };
  });

  const totals = rows.reduce(
    (summary, row) => {
      summary.totalCollected += row.stats.totalCollected;
      summary.pendingAmount += row.stats.pendingAmount;
      summary.totalExpenses += row.stats.totalExpenses;
      summary.balance += row.stats.balance;
      return summary;
    },
    {
      societyCount: rows.length,
      totalCollected: 0,
      pendingAmount: 0,
      totalExpenses: 0,
      balance: 0,
    },
  );

  return Response.json({ societies: rows, totals });
}
