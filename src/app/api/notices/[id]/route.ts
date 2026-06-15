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

const LEGACY_ROUTE = "/api/notices/[id]";
const NEST_GET = "/api/v1/community/notices/detail/get";
const NEST_PATCH = "/api/v1/community/notices/detail/update";
const NEST_DELETE = "/api/v1/community/notices/detail/remove";

async function legacyDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.notice.deleteMany({
    where: { id, societyId: session!.societyId },
  });

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

  const updated = await prisma.notice.update({
    where: { id },
    data: {
      isPinned: body.isPinned ?? undefined,
    },
  });

  return Response.json({ notice: updated });
}

export const DELETE = shimOrFallback({ legacyRoute: "/api/notices", nestPath: "/api/v1/community/notices", method: "DELETE" }, legacyDELETE);
export const PATCH = shimOrFallback({ legacyRoute: "/api/notices", nestPath: "/api/v1/community/notices", method: "PATCH" }, legacyPATCH);
