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

const LEGACY_ROUTE = "/api/visitors/[id]";
const NEST_GET = "/api/v1/operations/visitors/detail/get";
const NEST_PATCH = "/api/v1/operations/visitors/detail/update";

async function legacyPATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const visitor = await prisma.visitor.update({
      where: { id },
      data: {
        status: body.status || "out",
        exitTime: body.status === "out" ? new Date() : undefined,
      },
    });
    return Response.json({ visitor });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const PATCH = shimOrFallback({ legacyRoute: "/api/visitors", nestPath: "/api/v1/operations/visitors", method: "PATCH" }, legacyPATCH);
