import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAmenityBookable, ensureAmenityForFacility, getOccupancyContext } from "@/domain/community";
import { shouldSkipDuesEnforcement } from "@/lib/dues-enforcement-access";
import { isCommitteeRole, isResidentRole } from "@/lib/roles";
import { assertFlatDuesClear } from "@society/db";
import { NextRequest } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/facilities/bookings";
const NEST_GET = "/api/v1/operations/amenities/bookings/list";
const NEST_POST = "/api/v1/operations/amenities/bookings/create";

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isCommitteeRole(session.role)) {
    return Response.json(
      { error: "Committee members manage amenities. Residents book slots from their login." },
      { status: 403 },
    );
  }

  if (!isResidentRole(session.role)) {
    return Response.json({ error: "Only flat residents can book amenities" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { facilityId, flatNumber, date, startTime, endTime, purpose } = body;

    if (!facilityId || !flatNumber || !date || !startTime || !endTime) {
      return Response.json({ error: "All fields are required" }, { status: 400 });
    }

    const context = await getOccupancyContext(session);
    const targetFlatId = context?.flat?.id;
    if (targetFlatId && !shouldSkipDuesEnforcement(session.role)) {
      try {
        await assertFlatDuesClear({
          societyId: session.societyId,
          flatId: targetFlatId,
          feature: "amenity_booking",
        });
      } catch (error) {
        return Response.json(
          {
            error: error instanceof Error ? error.message : "Dues enforcement blocked this booking",
            code: "DUES_ENFORCEMENT",
          },
          { status: 403 },
        );
      }
    }

    // Check for conflicts
    const dateObj = new Date(date);
    const conflict = await prisma.facilityBooking.findFirst({
      where: {
        facilityId,
        date: dateObj,
        status: "confirmed",
        OR: [
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: startTime }, endTime: { lte: endTime } },
        ],
      },
    });

    if (conflict) {
      return Response.json({ error: "Time slot already booked" }, { status: 400 });
    }

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, societyId: session.societyId },
    });
    if (!facility) {
      return Response.json({ error: "Amenity not found" }, { status: 404 });
    }

    const amenity = await ensureAmenityForFacility(facilityId);
    if (!amenity) {
      return Response.json({ error: "Amenity not available" }, { status: 404 });
    }

    const policyError = await assertAmenityBookable(amenity.id, {
      date: dateObj,
      startTime,
      endTime,
    });
    if (policyError) {
      return Response.json({ error: policyError }, { status: 400 });
    }

    const hours = (parseInt(endTime.split(":")[0]) - parseInt(startTime.split(":")[0]));
    const amount = (facility?.ratePerHour || 0) * Math.max(hours, 1);

    const booking = await prisma.facilityBooking.create({
      data: {
        societyId: session!.societyId,
        facilityId,
        amenityId: amenity.id,
        personId: context?.person?.id || null,
        unitOccupancyId: context?.occupancy?.id || null,
        bookedBy: session.name,
        flatNumber: context?.flat?.flatNumber || flatNumber,
        date: dateObj,
        startTime,
        endTime,
        purpose: purpose || null,
        amount,
      },
    });

    return Response.json({ booking }, { status: 201 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function legacyGET(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId") || "";
  const myOnly = searchParams.get("my") === "true";

  const where: Record<string, unknown> = { societyId: session!.societyId };
  if (facilityId) where.facilityId = facilityId;

  if (myOnly) {
    if (isCommitteeRole(session.role)) {
      return Response.json({ bookings: [] });
    }
    const context = await getOccupancyContext(session);
    const flatNumber = context?.flat?.flatNumber;
    if (flatNumber) where.flatNumber = flatNumber;
  }

  const bookings = await prisma.facilityBooking.findMany({
    where,
    include: { facility: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  return Response.json({ bookings });
}

export const POST = shimOrFallback({ legacyRoute: "/api/facilities", nestPath: "/api/v1/operations/amenities", method: "POST" }, legacyPOST);
export const GET = shimOrFallback({ legacyRoute: "/api/facilities", nestPath: "/api/v1/operations/amenities", method: "GET" }, legacyGET);
