import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/reports/annual";
const NEST_GET = "/api/v1/finance-core/reports/annual/generate";

async function legacyGET(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

  const months = [];
  let totalGenerated = 0;
  let totalCollected = 0;
  let totalPending = 0;

  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, "0")}`;
    const bills = await prisma.maintenanceBill.findMany({
      where: { societyId: session!.societyId, period },
    });

    const paid = bills.filter((b) => b.status === "paid");
    const pending = bills.filter((b) => b.status === "pending");

    const generated = bills.reduce((s, b) => s + b.amount, 0);
    const collected = paid.reduce((s, b) => s + (b.paidAmount || b.amount), 0);
    const pendingAmt = pending.reduce((s, b) => s + b.amount, 0);

    totalGenerated += generated;
    totalCollected += collected;
    totalPending += pendingAmt;

    months.push({
      period,
      month: new Date(year, m - 1).toLocaleDateString("en-IN", { month: "long" }),
      generated,
      collected,
      pending: pendingAmt,
      rate: bills.length > 0 ? Math.round((paid.length / bills.length) * 100) : 0,
    });
  }

  return Response.json({
    year,
    months,
    totals: {
      generated: totalGenerated,
      collected: totalCollected,
      pending: totalPending,
      rate: totalGenerated > 0 ? Math.round((totalCollected / totalGenerated) * 100) : 0,
    },
  });
}

export const GET = shimOrFallback({ legacyRoute: "/api/reports", nestPath: "/api/v1/finance-core/reports", method: "GET" }, legacyGET);
