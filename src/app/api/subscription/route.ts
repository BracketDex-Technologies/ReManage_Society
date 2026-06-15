import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

// GET: Check subscription status
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const society = await prisma.society.findUnique({
      where: { id: session!.societyId },
      select: {
        id: true,
        name: true,
        planTier: true,
        subscriptionEnd: true,
        rechargeHistory: true,
      },
    });

    if (!society) {
      return Response.json({ error: "Society not found" }, { status: 404 });
    }

    const now = new Date();
    const isActive = society.subscriptionEnd ? new Date(society.subscriptionEnd) > now : true;
    const daysLeft = society.subscriptionEnd
      ? Math.ceil((new Date(society.subscriptionEnd).getTime() - now.getTime()) / 86400000)
      : 999;

    return Response.json({
      active: isActive,
      plan: society.planTier,
      expiresAt: society.subscriptionEnd,
      daysLeft: Math.max(0, daysLeft),
      society: society.name,
    });
  } catch {
    return Response.json({ error: "Failed to check subscription" }, { status: 500 });
  }
}

// POST: Add recharge (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session!.role)) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { months, amount, transactionId, plan } = await request.json();

    if (!months || !amount) {
      return Response.json({ error: "Months and amount required" }, { status: 400 });
    }

    const society = await prisma.society.findUnique({
      where: { id: session!.societyId },
    });

    if (!society) {
      return Response.json({ error: "Society not found" }, { status: 404 });
    }

    // Calculate new expiry
    const currentEnd = society.subscriptionEnd && new Date(society.subscriptionEnd) > new Date()
      ? new Date(society.subscriptionEnd)
      : new Date();
    currentEnd.setMonth(currentEnd.getMonth() + parseInt(months));

    // Build recharge history
    const history = society.rechargeHistory ? JSON.parse(society.rechargeHistory) : [];
    history.push({
      date: new Date().toISOString(),
      months: parseInt(months),
      amount: parseFloat(amount),
      transactionId: transactionId || null,
      plan: plan || society.planTier,
      rechargedBy: session.name,
    });

    await prisma.society.update({
      where: { id: session!.societyId },
      data: {
        subscriptionEnd: currentEnd,
        planTier: plan || society.planTier,
        rechargeHistory: JSON.stringify(history),
      },
    });

    return Response.json({
      success: true,
      newExpiry: currentEnd,
      plan: plan || society.planTier,
    });
  } catch {
    return Response.json({ error: "Recharge failed" }, { status: 500 });
  }
}
