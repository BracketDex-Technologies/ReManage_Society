import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/forum/[threadId]";
const NEST_GET = "/api/v1/community/forum/thread/get";
const NEST_POST = "/api/v1/community/forum/thread/reply";

async function legacyGET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;

    const thread = await prisma.forumThread.findFirst({
      where: { id: threadId, societyId: session!.societyId },
      include: {
        author: { select: { name: true, role: true } },
        replies: {
          include: { author: { select: { name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }

    // Increment view count
    await prisma.forumThread.update({
      where: { id: threadId },
      data: { views: { increment: 1 } },
    });

    return Response.json(thread);
  } catch {
    return Response.json({ error: "Failed to fetch thread" }, { status: 500 });
  }
}

// POST: Add reply
async function legacyPOST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;
    const { content } = await request.json();

    if (!content?.trim()) {
      return Response.json({ error: "Reply content required" }, { status: 400 });
    }

    const thread = await prisma.forumThread.findFirst({
      where: { id: threadId, societyId: session!.societyId },
    });

    if (!thread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }

    if (thread.isLocked) {
      return Response.json({ error: "Thread is locked" }, { status: 403 });
    }

    const reply = await prisma.forumReply.create({
      data: {
        threadId,
        authorId: session.userId,
        content: content.trim(),
      },
      include: { author: { select: { name: true, role: true } } },
    });

    // Update thread's last activity
    await prisma.forumThread.update({
      where: { id: threadId },
      data: { lastActivityAt: new Date() },
    });

    return Response.json(reply, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to post reply" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/forum", nestPath: "/api/v1/community/forum", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/forum", nestPath: "/api/v1/community/forum", method: "POST" }, legacyPOST);
