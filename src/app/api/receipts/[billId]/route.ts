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

const LEGACY_ROUTE = "/api/receipts/[billId]";
const NEST_POST = "/api/v1/finance-core/payments/record";

async function legacyGET(
  _request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { billId } = await params;

  const bill = await prisma.maintenanceBill.findFirst({
    where: {
      id: billId,
      societyId: session!.societyId,
      ...(session.role === "member" || session.role === "tenant" ? { flatId: session.flatId } : {}),
    },
    include: { flat: true, society: true },
  });

  if (!bill) {
    return Response.json({ error: "Receipt not found" }, { status: 404 });
  }

  return Response.json({ bill });
}

export const GET = shimOrFallback({ legacyRoute: "/api/receipts", nestPath: "/api/v1/finance-core/payments/record", method: "GET" }, legacyGET);
