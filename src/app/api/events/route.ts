import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isCommitteeRole, isResidentRole } from "@/lib/roles";
import { NextRequest } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/events";
const NEST_GET = "/api/v1/community/events/list";
const NEST_POST = "/api/v1/community/events/create";

async function legacyGET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM format
    const upcoming = searchParams.get("upcoming") === "true";

    const where: Record<string, unknown> = { societyId: session!.societyId };

    if (upcoming) {
      where.startDate = { gte: new Date() };
    } else if (month) {
      const [year, m] = month.split("-").map(Number);
      where.startDate = {
        gte: new Date(year, m - 1, 1),
        lt: new Date(year, m, 1),
      };
    }

    const events = await prisma.societyEvent.findMany({
      where,
      include: {
        organizer: { select: { name: true, role: true } },
        _count: { select: { rsvps: true } },
      },
      orderBy: { startDate: "asc" },
    });

    return Response.json(events);
  } catch {
    return Response.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session!.role)) {
      return Response.json({ error: "Only committee members can create events" }, { status: 403 });
    }

    const { title, description, startDate, endDate, venue, category, maxAttendees } = await request.json();

    if (!title?.trim() || !startDate) {
      return Response.json({ error: "Title and start date required" }, { status: 400 });
    }

    const event = await prisma.societyEvent.create({
      data: {
        societyId: session!.societyId,
        organizerId: session.userId,
        title: title.trim(),
        description: description?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        venue: venue?.trim() || null,
        category: category || "general",
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
      },
      include: {
        organizer: { select: { name: true } },
        _count: { select: { rsvps: true } },
      },
    });

    // Notify society
    await prisma.notification.create({
      data: {
        societyId: session!.societyId,
        type: "event",
        title: `📅 New Event: ${title}`,
        message: `${title} on ${new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}${venue ? ` at ${venue}` : ""}`,
        link: "/events",
      },
    });

    return Response.json(event, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create event" }, { status: 500 });
  }
}

// PATCH: RSVP to event
async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId, response } = await request.json();

    if (!eventId || !response) {
      return Response.json({ error: "Event ID and response required" }, { status: 400 });
    }

    if (isCommitteeRole(session.role)) {
      return Response.json({ error: "Committee members publish events; residents RSVP from their login." }, { status: 403 });
    }

    if (!isResidentRole(session.role)) {
      return Response.json({ error: "Only flat residents can RSVP" }, { status: 403 });
    }

    const event = await prisma.societyEvent.findFirst({
      where: { id: eventId, societyId: session!.societyId },
      include: { _count: { select: { rsvps: true } } },
    });

    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // Check capacity
    if (response === "attending" && event.maxAttendees && event._count.rsvps >= event.maxAttendees) {
      return Response.json({ error: "Event is at full capacity" }, { status: 409 });
    }

    // Upsert RSVP
    const rsvp = await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId: session.userId } },
      update: { response },
      create: { eventId, userId: session.userId, response },
    });

    return Response.json(rsvp);
  } catch {
    return Response.json({ error: "Failed to RSVP" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/events", nestPath: "/api/v1/community/events", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/events", nestPath: "/api/v1/community/events", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/events", nestPath: "/api/v1/community/events", method: "PATCH" }, legacyPATCH);
