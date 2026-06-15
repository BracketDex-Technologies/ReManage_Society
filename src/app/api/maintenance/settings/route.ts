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

const LEGACY_ROUTE = "/api/maintenance/settings";
const NEST_GET = "/api/v1/finance-core/maintenance/settings/get";
const NEST_PUT = "/api/v1/finance-core/maintenance/settings/update";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const society = await prisma.society.findUnique({
    where: { id: session!.societyId },
  });

  return Response.json({ society });
}

async function legacyPUT(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const society = await prisma.society.update({
      where: { id: session!.societyId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.pincode !== undefined ? { pincode: body.pincode } : {}),
        ...(body.upiId !== undefined ? { upiId: body.upiId || null } : {}),
        ...(body.bankDetails !== undefined ? { bankDetails: body.bankDetails || null } : {}),
        ...(body.legalAdviserName !== undefined ? { legalAdviserName: body.legalAdviserName || null } : {}),
        ...(body.legalAdviserPhone !== undefined ? { legalAdviserPhone: body.legalAdviserPhone || null } : {}),
        maintenanceAmt: body.maintenanceAmt ? parseFloat(body.maintenanceAmt) : undefined,
        dueDayOfMonth: body.dueDayOfMonth ? parseInt(body.dueDayOfMonth) : undefined,
        ...(body.lateFee !== undefined ? { lateFee: body.lateFee ? parseFloat(body.lateFee) : 0 } : {}),
        ...(body.duesEnforcementEnabled !== undefined
          ? { duesEnforcementEnabled: !!body.duesEnforcementEnabled }
          : {}),
        ...(body.duesEnforcementDays !== undefined
          ? { duesEnforcementDays: Math.max(1, parseInt(String(body.duesEnforcementDays), 10) || 60) }
          : {}),
      },
    });

    return Response.json({ society });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/maintenance", nestPath: "/api/v1/finance-core", method: "GET" }, legacyGET);
export const PUT = shimOrFallback({ legacyRoute: "/api/maintenance", nestPath: "/api/v1/finance-core", method: "PUT" }, legacyPUT);
