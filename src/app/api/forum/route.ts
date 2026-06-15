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

const LEGACY_ROUTE = "/api/forum";
const NEST_GET = "/api/v1/community/forum/list";
const NEST_POST = "/api/v1/community/forum/create";

async function legacyGET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;

    const where: Record<string, unknown> = { societyId: session!.societyId };
    if (category && category !== "all") where.category = category;

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        include: {
          author: { select: { name: true, role: true } },
          _count: { select: { replies: true } },
        },
        orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.forumThread.count({ where }),
    ]);

    return Response.json({ threads, total, page, pages: Math.ceil(total / limit) });
  } catch {
    return Response.json({ error: "Failed to fetch threads" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content, category } = await request.json();

    if (!title?.trim() || !content?.trim()) {
      return Response.json({ error: "Title and content are required" }, { status: 400 });
    }

    const thread = await prisma.forumThread.create({
      data: {
        societyId: session!.societyId,
        authorId: session.userId,
        title: title.trim(),
        content: content.trim(),
        category: category || "general",
      },
      include: {
        author: { select: { name: true, role: true } },
        _count: { select: { replies: true } },
      },
    });

    return Response.json(thread, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create thread" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/forum", nestPath: "/api/v1/community/forum", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/forum", nestPath: "/api/v1/community/forum", method: "POST" }, legacyPOST);
