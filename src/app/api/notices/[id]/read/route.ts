import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

// Mark notice as read by current user
const LEGACY_ROUTE = "/api/notices/[id]/read";
const NEST_POST = "/api/v1/community/notices/read/mark";

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Upsert so duplicate reads don't error
  await prisma.noticeRead.upsert({
    where: {
      noticeId_userId: {
        noticeId: id,
        userId: session.userId,
      },
    },
    create: {
      noticeId: id,
      societyId: session!.societyId,
      userId: session.userId,
      userName: session.name || "Unknown",
      flatNumber: session.flatId || null,
    },
    update: {
      readAt: new Date(),
    },
  });

  return Response.json({ success: true });
}

// Get read receipts for a notice (admin only)
async function legacyGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const reads = await prisma.noticeRead.findMany({
    where: { noticeId: id, societyId: session!.societyId },
    orderBy: { readAt: "desc" },
  });

  const totalMembers = await prisma.user.count({
    where: { societyId: session!.societyId },
  });

  return Response.json({
    reads,
    totalReads: reads.length,
    totalMembers,
    readPercentage: totalMembers > 0 ? Math.round((reads.length / totalMembers) * 100) : 0,
  });
}

export const POST = shimOrFallback({ legacyRoute: "/api/notices", nestPath: "/api/v1/community/notices", method: "POST" }, legacyPOST);
export const GET = shimOrFallback({ legacyRoute: "/api/notices", nestPath: "/api/v1/community/notices", method: "GET" }, legacyGET);
