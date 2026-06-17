import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { defaultSlaHours } from "@society/community-core";
import { logCreated } from "@/lib/activity-log";
import { broadcastNotification } from "@/lib/notifications";
import {
  buildComplaintWhereClause,
  filterComplaintsByScope,
  resolveComplaintListScope,
  assertComplaintFlatAccess,
} from "@/lib/complaints/list-scope";
import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/complaints";
const NEST_LIST = "/api/v1/community/helpdesk/list";
const NEST_CREATE = "/api/v1/community/helpdesk/create";

type ComplaintRow = {
  status: string;
  satisfactionRating: number | null;
};

function buildComplaintStats(complaints: ComplaintRow[]) {
  const rated = complaints.filter((c) => c.satisfactionRating);
  const avgRating =
    rated.length > 0
      ? Math.round((rated.reduce((sum, c) => sum + (c.satisfactionRating ?? 0), 0) / rated.length) * 10) / 10
      : null;

  return {
    open: complaints.filter((c) => c.status === "open").length,
    inProgress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved" || c.status === "closed").length,
    pendingRating: complaints.filter((c) => c.status === "resolved" && !c.satisfactionRating).length,
    avgRating,
    total: complaints.length,
  };
}

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isNestShimEnabled()) {
    const scope = await resolveComplaintListScope(session);
    const proxied = await proxyNestJson<unknown[]>({
      path: NEST_LIST,
      session,
      body: { societyId: session.societyId },
    });

    if (proxied.ok) {
      const raw = Array.isArray(proxied.data) ? proxied.data : [];
      const complaints = filterComplaintsByScope(
        raw as Array<{ flatNumber: string; raisedBy: string }>,
        scope,
      );

      return jsonWithHeaders(
        {
          complaints,
          stats: buildComplaintStats(complaints as unknown as ComplaintRow[]),
          societyId: session.societyId,
          ...(scope.kind === "none" ? { noFlatLinked: true } : {}),
        },
        {
          status: 200,
          extraHeaders: {
            ...buildDeprecationHeaders({ routePath: LEGACY_ROUTE, successorPath: NEST_LIST }),
            ...passThroughRateLimitHeaders(proxied.headers),
          },
        },
      );
    }
  }

  const where = await buildComplaintWhereClause(session);
  const scope = await resolveComplaintListScope(session);

  const complaints = await prisma.complaint.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const society = await prisma.society.findUnique({
    where: { id: session.societyId },
    select: { legalAdviserName: true, legalAdviserPhone: true },
  });

  const stats = buildComplaintStats(complaints);

  return jsonWithHeaders(
    {
      complaints,
      stats,
      societyId: session!.societyId,
      legalAdviserName: society?.legalAdviserName ?? null,
      legalAdviserPhone: society?.legalAdviserPhone ?? null,
      ...(scope.kind === "none" ? { noFlatLinked: true } : {}),
    },
    {
      status: 200,
      extraHeaders: buildDeprecationHeaders({ routePath: LEGACY_ROUTE, successorPath: NEST_LIST }),
    },
  );
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { flatNumber, raisedBy, title, description, category, priority } = body;

    if (!flatNumber || !raisedBy || !title || !description) {
      return Response.json({ error: "All fields are required" }, { status: 400 });
    }

    const flatAccess = await assertComplaintFlatAccess(session, flatNumber);
    if (!flatAccess.ok) {
      return Response.json({ error: flatAccess.error }, { status: flatAccess.status });
    }

    const resolvedPriority = priority || "medium";
    const complaint = await prisma.complaint.create({
      data: {
        societyId: session!.societyId,
        flatNumber,
        raisedBy,
        title,
        description,
        category: category || "general",
        priority: resolvedPriority,
        slaHours: defaultSlaHours(resolvedPriority),
        escalationLevel: 0,
      },
    });

    // Audit log
    await logCreated("complaint", complaint.id, `${title} - Flat ${flatNumber}`, {
      category,
      priority,
      raisedBy,
    });

    // Notify committee
    await broadcastNotification(
      session!.societyId,
      "complaint_update",
      `New Complaint: ${title}`,
      `${raisedBy} from Flat ${flatNumber} raised a ${priority || "medium"} priority ${category || "general"} complaint.`,
      "/complaints"
    );

    return jsonWithHeaders(
      { complaint },
      {
        status: 201,
        extraHeaders: buildDeprecationHeaders({ routePath: LEGACY_ROUTE, successorPath: NEST_CREATE }),
      },
    );
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = legacyGET;
export const POST = shimOrFallback({ legacyRoute: "/api/complaints", nestPath: "/api/v1/community/helpdesk", method: "POST" }, legacyPOST);
