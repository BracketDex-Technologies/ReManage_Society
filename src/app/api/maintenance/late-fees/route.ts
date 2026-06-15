import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastNotification } from "@/lib/notifications";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

// Apply late fees to overdue bills
const LEGACY_ROUTE = "/api/maintenance/late-fees";
const NEST_POST = "/api/v1/finance-core/maintenance/late-fees/apply";

async function legacyPOST() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const society = await prisma.society.findUnique({
      where: { id: session!.societyId },
    });

    if (!society || !society.lateFee || society.lateFee <= 0) {
      return Response.json({ error: "Late fee not configured", applied: 0 });
    }

    // Find all pending bills where due date has passed
    const now = new Date();
    const overdueBills = await prisma.maintenanceBill.findMany({
      where: {
        societyId: session!.societyId,
        status: { in: ["pending", "partial"] },
        dueDate: { lt: now },
        lateFee: 0, // Only apply once
      },
      include: { flat: true },
    });

    let applied = 0;
    for (const bill of overdueBills) {
      await prisma.maintenanceBill.update({
        where: { id: bill.id },
        data: {
          lateFee: society.lateFee,
          totalAmount: bill.amount + society.lateFee + bill.gstAmount,
        },
      });
      applied++;
    }

    if (applied > 0) {
      await broadcastNotification(
        session!.societyId,
        "late_fee",
        "Late Fees Applied",
        `Late fee of ₹${society.lateFee} applied to ${applied} overdue bills.`,
        "/maintenance"
      );
    }

    return Response.json({
      applied,
      lateFeeAmount: society.lateFee,
      message: `Late fee applied to ${applied} overdue bills`,
    });
  } catch (error) {
    console.error("Late fee error:", error);
    return Response.json({ error: "Failed to apply late fees" }, { status: 500 });
  }
}

export const POST = shimOrFallback({ legacyRoute: "/api/maintenance", nestPath: "/api/v1/finance-core", method: "POST" }, legacyPOST);
