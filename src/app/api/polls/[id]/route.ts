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

const LEGACY_ROUTE = "/api/polls/[id]";
const NEST_GET = "/api/v1/community/polls/detail/get";
const NEST_POST = "/api/v1/community/polls/detail/vote";

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

    // If voting
    if (body.vote !== undefined && body.flatNumber) {
      const poll = await prisma.poll.findUnique({ where: { id } });
      if (!poll) return Response.json({ error: "Poll not found" }, { status: 404 });
      if (poll.status !== "active") return Response.json({ error: "Poll is closed" }, { status: 400 });

      const voters: string[] = JSON.parse(poll.voters);
      if (voters.includes(body.flatNumber)) {
        return Response.json({ error: "Already voted" }, { status: 400 });
      }

      const votes: Record<string, number> = JSON.parse(poll.votes);
      const optionKey = body.vote.toString();
      votes[optionKey] = (votes[optionKey] || 0) + 1;
      voters.push(body.flatNumber);

      const updated = await prisma.poll.update({
        where: { id },
        data: {
          votes: JSON.stringify(votes),
          voters: JSON.stringify(voters),
        },
      });

      return Response.json({ poll: updated });
    }

    // If closing poll
    if (body.status === "closed") {
      const updated = await prisma.poll.update({
        where: { id },
        data: { status: "closed" },
      });
      return Response.json({ poll: updated });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const PATCH = shimOrFallback({ legacyRoute: "/api/polls", nestPath: "/api/v1/community/polls", method: "PATCH" }, legacyPATCH);
