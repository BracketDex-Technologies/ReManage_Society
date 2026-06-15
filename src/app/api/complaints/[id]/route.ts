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

const LEGACY_ROUTE = "/api/complaints/[id]";
const NEST_PATCH = "/api/v1/community/helpdesk/detail/update";
const NEST_DELETE = "/api/v1/community/helpdesk/detail/remove";

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

  const complaint = await prisma.complaint.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!complaint) {
    return Response.json({ error: "Complaint not found" }, { status: 404 });
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status: body.status || complaint.status,
      resolution: body.resolution ?? complaint.resolution,
      resolvedAt: body.status === "resolved" || body.status === "closed" ? new Date() : complaint.resolvedAt,
    },
  });

  return Response.json({ complaint: updated });
}

async function legacyDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.complaint.deleteMany({
    where: { id, societyId: session!.societyId },
  });

  return Response.json({ success: true });
}

export const PATCH = shimOrFallback({ legacyRoute: "/api/complaints", nestPath: "/api/v1/community/helpdesk", method: "PATCH" }, legacyPATCH);
export const DELETE = shimOrFallback({ legacyRoute: "/api/complaints", nestPath: "/api/v1/community/helpdesk", method: "DELETE" }, legacyDELETE);
