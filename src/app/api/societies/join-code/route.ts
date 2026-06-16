import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/join-code";
import { NextRequest } from "next/server";
import { ensureUnitsForSociety } from "@/domain/unit-migration";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/societies/join-code";
const NEST_GET = "/api/v1/society-core/join-code/get";
const NEST_POST = "/api/v1/society-core/join-code/regenerate";

async function legacyGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = normalizeJoinCode(searchParams.get("code") || "");

  if (!code) {
    return Response.json({ error: "Join code is required" }, { status: 400 });
  }

  const society = await prisma.society.findUnique({
    where: { joinCode: code },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      pincode: true,
      flats: {
        where: { isActive: true },
        select: {
          id: true,
          flatNumber: true,
          wing: true,
          floor: true,
          ownerName: true,
          users: { select: { role: true } },
        },
        orderBy: { flatNumber: "asc" },
      },
    },
  });

  if (!society) {
    return Response.json({ error: "Invalid join code" }, { status: 404 });
  }

  await ensureUnitsForSociety(society.id);

  const units = await prisma.unit.findMany({
    where: { societyId: society.id, isActive: true },
    include: {
      occupancies: {
        where: { isActive: true, occupancyStatus: "ACTIVE" },
        include: { person: { select: { name: true, phone: true, users: { select: { email: true }, take: 1 } } } },
      },
      legacyFlat: { select: { ownerName: true, contact: true, email: true, tenantName: true } },
    },
    orderBy: [{ wing: "asc" }, { floor: "asc" }, { flatNumber: "asc" }],
  });

  return Response.json({
    society: {
      id: society.id,
      name: society.name,
      address: society.address,
      city: society.city,
      pincode: society.pincode,
    },
    flats: units.map((unit) => {
      const owner = unit.occupancies.find((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
      const tenant = unit.occupancies.find((item) => item.relationshipType === "TENANT");
      const primary = unit.occupancies.find((item) => item.isPrimaryOccupant) || owner || tenant;
      return {
        id: unit.legacyFlatId || unit.id,
        unitId: unit.id,
        flatNumber: unit.flatNumber,
        wing: unit.wing,
        floor: unit.floor,
        ownerName: owner?.person.name || unit.legacyFlat?.ownerName || null,
        ownerPhone: owner?.person.phone || unit.legacyFlat?.contact || null,
        ownerEmail: owner?.person.users[0]?.email || unit.legacyFlat?.email || null,
        tenantName: tenant?.person.name || unit.legacyFlat?.tenantName || null,
        tenantPhone: tenant?.person.phone || null,
        occupancyStatus: unit.occupancyStatus,
        ownershipStatus: unit.ownershipStatus,
        billingStatus: unit.billingStatus,
        primaryOccupant: primary?.person.name || null,
        hasMember: Boolean(owner),
        hasTenant: Boolean(tenant),
      };
    }),
  });
}

export const GET = shimOrFallback(
  { legacyRoute: "/api/societies", nestPath: "/api/v1/society-core", method: "GET", requireAuth: false },
  legacyGET,
);
