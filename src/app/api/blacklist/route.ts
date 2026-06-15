import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/blacklist";
const NEST_GET = "/api/v1/operations/blacklist/list";
const NEST_POST = "/api/v1/operations/blacklist/add";

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blacklist = await prisma.blacklist.findMany({
      where: { societyId: session!.societyId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(blacklist);
  } catch {
    return Response.json({ error: "Failed to fetch blacklist" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session!.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, phone, reason, photoUrl } = await request.json();

    if (!name || !reason) {
      return Response.json({ error: "Name and reason required" }, { status: 400 });
    }

    const entry = await prisma.blacklist.create({
      data: {
        societyId: session!.societyId,
        name,
        phone: phone || null,
        reason,
        photoUrl: photoUrl || null,
        addedBy: session.userId,
      },
    });

    return Response.json(entry);
  } catch {
    return Response.json({ error: "Failed to add to blacklist" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session!.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, isActive } = await request.json();

    const entry = await prisma.blacklist.update({
      where: { id },
      data: { isActive: isActive ?? false },
    });

    return Response.json(entry);
  } catch {
    return Response.json({ error: "Failed to update blacklist" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/blacklist", nestPath: "/api/v1/operations/blacklist", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/blacklist", nestPath: "/api/v1/operations/blacklist", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/blacklist", nestPath: "/api/v1/operations/blacklist", method: "PATCH" }, legacyPATCH);
