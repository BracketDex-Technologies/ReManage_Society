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

const LEGACY_ROUTE = "/api/facilities";
const NEST_GET = "/api/v1/operations/amenities/list";
const NEST_POST = "/api/v1/operations/amenities/create";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const facilities = await prisma.facility.findMany({
    where: { societyId: session!.societyId },
    include: {
      bookings: {
        where: { date: { gte: new Date() }, status: "confirmed" },
        orderBy: { date: "asc" },
        take: 5,
      },
    },
    orderBy: { name: "asc" },
  });

  return Response.json({ facilities });
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, capacity, ratePerHour, rules } = body;

    if (!name) {
      return Response.json({ error: "Facility name is required" }, { status: 400 });
    }

    const facility = await prisma.facility.create({
      data: {
        societyId: session!.societyId,
        name,
        description: description || null,
        capacity: capacity ? parseInt(capacity) : null,
        ratePerHour: ratePerHour ? parseFloat(ratePerHour) : 0,
        rules: rules || null,
      },
    });

    const amenity = await prisma.amenity.create({
      data: {
        societyId: session.societyId,
        name,
        description: description || null,
        capacity: capacity ? parseInt(capacity) : null,
        ratePerHour: ratePerHour ? parseFloat(ratePerHour) : 0,
        rules: rules || null,
      },
    });

    await prisma.facility.update({ where: { id: facility.id }, data: { amenityId: amenity.id } });

    return Response.json({ facility }, { status: 201 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/facilities", nestPath: "/api/v1/operations/amenities", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/facilities", nestPath: "/api/v1/operations/amenities", method: "POST" }, legacyPOST);
