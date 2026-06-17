import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { applyComplaintTransition, type ComplaintStatus } from "@society/community-core";
import { isCommitteeRole } from "@/lib/roles";
import { logUpdated } from "@/lib/activity-log";
import { broadcastNotification } from "@/lib/notifications";

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

  if (!isCommitteeRole(session.role)) {
    return Response.json({ error: "Only committee members can update complaint status" }, { status: 403 });
  }

  const complaint = await prisma.complaint.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!complaint) {
    return Response.json({ error: "Complaint not found" }, { status: 404 });
  }

  const nextStatus = body.status as ComplaintStatus | undefined;
  let status = complaint.status as ComplaintStatus;
  let resolvedAt = complaint.resolvedAt;

  if (nextStatus && nextStatus !== complaint.status) {
    const action =
      nextStatus === "in_progress"
        ? "start"
        : nextStatus === "resolved"
          ? "resolve"
          : nextStatus === "closed"
            ? "close"
            : nextStatus === "open"
              ? "reopen"
              : null;

    if (!action) {
      return Response.json({ error: "Invalid status transition" }, { status: 400 });
    }

    try {
      ({ status } = applyComplaintTransition({
        current: complaint.status as ComplaintStatus,
        action,
      }));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid status transition" },
        { status: 400 },
      );
    }

    if (status === "resolved" || status === "closed") {
      resolvedAt = new Date();
    } else if (action === "reopen") {
      resolvedAt = null;
    }
  }

  const resolution =
    typeof body.resolution === "string" && body.resolution.trim()
      ? body.resolution.trim()
      : complaint.resolution;

  if (status === "resolved" && !resolution?.trim()) {
    return Response.json({ error: "Resolution notes are required when marking as resolved" }, { status: 400 });
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status,
      resolution,
      resolvedAt,
    },
  });

  await logUpdated("complaint", id, complaint.title, {
    from: complaint.status,
    to: status,
  });

  if (status === "resolved" && complaint.status !== "resolved") {
    await broadcastNotification(
      session.societyId,
      "complaint_update",
      `Complaint resolved: ${complaint.title}`,
      `Your ${complaint.category} complaint has been marked resolved. Please rate the service.`,
      "/complaints",
    );
  }

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
