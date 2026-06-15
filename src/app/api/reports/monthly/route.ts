import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getBillingTargetsForSociety, targetsByFlatId } from "@/domain/billing";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/reports/monthly";
const NEST_GET = "/api/v1/finance-core/reports/monthly/generate";

async function legacyGET(request: NextRequest) {
  try {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "";

  const billingTargets = await getBillingTargetsForSociety(session.societyId);
  const billingTargetByFlatId = targetsByFlatId(billingTargets);
  const billableFlatIds = billingTargets.map((target) => target.flatId);

  const [totalFlats, bills] = await Promise.all([
    prisma.flat.count({ where: { societyId: session.societyId, isActive: true } }),
    prisma.maintenanceBill.findMany({
      where: {
        societyId: session!.societyId,
        period,
        flatId: { in: billableFlatIds },
      },
      include: {
        flat: {
          include: {
            users: {
              where: { role: { in: ["member", "tenant"] } },
              select: { name: true, phone: true },
            },
          },
        },
      },
    }),
  ]);

  const paidBills = bills.filter((b) => b.status === "paid");
  const pendingBills = bills.filter((b) => b.status === "pending" || b.status === "partial");

  // Payment method breakdown
  const methods: Record<string, { count: number; amount: number }> = {};
  for (const b of paidBills) {
    const via = b.paidVia || "other";
    if (!methods[via]) methods[via] = { count: 0, amount: 0 };
    methods[via].count++;
    methods[via].amount += b.paidAmount || b.totalAmount || b.amount;
  }

  const activeFlatCount = billableFlatIds.length;
  const vacantFlatCount = Math.max(0, totalFlats - activeFlatCount);
  const totalCollected = paidBills.reduce((s, b) => s + (b.paidAmount || b.totalAmount || b.amount), 0)
    + bills.filter((b) => b.status === "partial").reduce((s, b) => s + (b.paidAmount || 0), 0);
  const totalPending = pendingBills.reduce((s, b) => {
    const total = b.totalAmount || b.amount + b.lateFee + b.gstAmount;
    return s + Math.max(0, total - (b.paidAmount || 0));
  }, 0);

  return Response.json({
    summary: {
      totalFlats,
      activeFlats: activeFlatCount,
      vacantFlats: vacantFlatCount,
      billsGenerated: bills.length,
      paid: paidBills.length,
      pending: pendingBills.length,
      totalCollected,
      totalPending,
      collectionRate: bills.length > 0 ? Math.round((paidBills.length / bills.length) * 100) : 0,
    },
    paymentMethodBreakdown: Object.entries(methods).map(([method, data]) => ({
      method,
      ...data,
    })),
    pendingFlats: pendingBills.map((b) => ({
      flatNumber: b.flat.flatNumber,
      ownerName: billingTargetByFlatId.get(b.flatId)?.payerName || b.flat.ownerName || b.flat.users[0]?.name || "Linked resident",
      payerRole: billingTargetByFlatId.get(b.flatId)?.payerRole || "Resident",
      contact: billingTargetByFlatId.get(b.flatId)?.payerPhone || b.flat.contact || b.flat.users[0]?.phone || "",
      amount: Math.max(0, (b.totalAmount || b.amount + b.lateFee + b.gstAmount) - (b.paidAmount || 0)),
    })),
  });
  } catch (error) {
    console.error("Monthly report error:", error);
    return Response.json({ error: "Failed to generate monthly report" }, { status: 500 });
  }
}

export const GET = shimOrFallback(
  { legacyRoute: LEGACY_ROUTE, nestPath: NEST_GET, method: "GET" },
  legacyGET,
);
