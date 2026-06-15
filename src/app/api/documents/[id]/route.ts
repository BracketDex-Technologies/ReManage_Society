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

const LEGACY_ROUTE = "/api/documents/[id]";
const NEST_GET = "/api/v1/community/documents/detail/get";
const NEST_DELETE = "/api/v1/community/documents/detail/remove";

async function legacyDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.document.delete({ where: { id } });
  return Response.json({ success: true });
}

export const DELETE = shimOrFallback({ legacyRoute: "/api/documents", nestPath: "/api/v1/community/documents", method: "DELETE" }, legacyDELETE);
