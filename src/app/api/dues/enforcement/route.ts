import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFlatDuesEnforcement } from "@society/db";
import { shouldSkipDuesEnforcement } from "@/lib/dues-enforcement-access";

export async function GET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { flatId: true, role: true },
  });

  if (!user?.flatId) {
    return Response.json({
      enforcement: {
        blocked: false,
        enabled: true,
        maxOverdueDays: 60,
        message: null,
        totalOverdueAmount: 0,
        oldestOverdueDays: 0,
        overdueBills: [],
        skipped: true,
        reason: "no_flat",
      },
    });
  }

  const evaluation = await getFlatDuesEnforcement({
    societyId: session.societyId,
    flatId: user.flatId,
  });

  return Response.json({
    enforcement: {
      blocked: shouldSkipDuesEnforcement(user.role) ? false : evaluation.blocked,
      enabled: evaluation.enabled,
      maxOverdueDays: evaluation.maxOverdueDays,
      message: evaluation.message,
      totalOverdueAmount: evaluation.totalOverdueAmount,
      oldestOverdueDays: evaluation.oldestOverdueDays,
      overdueBills: evaluation.overdueBills.map((bill) => ({
        id: bill.id,
        period: bill.period,
        remainingAmount: bill.remainingAmount,
        daysOverdue: bill.daysOverdue,
      })),
      skipped: shouldSkipDuesEnforcement(user.role),
    },
  });
}
