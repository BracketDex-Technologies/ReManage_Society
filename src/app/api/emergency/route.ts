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

const LEGACY_ROUTE = "/api/emergency";
const NEST_GET = "/api/v1/operations/emergency/list";
const NEST_POST = "/api/v1/operations/emergency/create";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await prisma.emergencyContact.findMany({
    where: { societyId: session!.societyId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return Response.json({ contacts });
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, phone, category, address, notes } = body;

    if (!name || !phone || !category) {
      return Response.json({ error: "Name, phone, and category are required" }, { status: 400 });
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        societyId: session!.societyId,
        name,
        phone,
        category,
        address: address || null,
        notes: notes || null,
      },
    });

    return Response.json({ contact }, { status: 201 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/emergency", nestPath: "/api/v1/operations/sos", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/emergency", nestPath: "/api/v1/operations/sos", method: "POST" }, legacyPOST);
