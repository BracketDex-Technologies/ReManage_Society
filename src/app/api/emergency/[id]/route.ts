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

const LEGACY_ROUTE = "/api/emergency/[id]";
const NEST_PATCH = "/api/v1/operations/emergency/detail/update";

async function legacyDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.emergencyContact.delete({ where: { id } });
  return Response.json({ success: true });
}

async function legacyPATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const contact = await prisma.emergencyContact.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone,
      category: body.category,
      address: body.address || null,
      notes: body.notes || null,
      isAvailable: body.isAvailable !== undefined ? body.isAvailable : true,
    },
  });

  return Response.json({ contact });
}

export const DELETE = shimOrFallback({ legacyRoute: "/api/emergency", nestPath: "/api/v1/operations/sos", method: "DELETE" }, legacyDELETE);
export const PATCH = shimOrFallback({ legacyRoute: "/api/emergency", nestPath: "/api/v1/operations/sos", method: "PATCH" }, legacyPATCH);
