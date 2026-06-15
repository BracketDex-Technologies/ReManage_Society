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

const LEGACY_ROUTE = "/api/polls";
const NEST_GET = "/api/v1/community/polls/list";
const NEST_POST = "/api/v1/community/polls/create";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polls = await prisma.poll.findMany({
    where: { societyId: session!.societyId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ polls });
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, options, closesAt } = body;

    if (!title || !options || options.length < 2) {
      return Response.json({ error: "Title and at least 2 options are required" }, { status: 400 });
    }

    const poll = await prisma.poll.create({
      data: {
        societyId: session!.societyId,
        title,
        description: description || null,
        options: JSON.stringify(options),
        votes: JSON.stringify({}),
        voters: JSON.stringify([]),
        createdBy: session.name,
        closesAt: closesAt ? new Date(closesAt) : null,
      },
    });

    return Response.json({ poll }, { status: 201 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/polls", nestPath: "/api/v1/community/polls", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/polls", nestPath: "/api/v1/community/polls", method: "POST" }, legacyPOST);
