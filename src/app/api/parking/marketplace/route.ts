import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findParkingOverlap, getOccupancyContext, parseParkingEndDate } from "@/domain/community";
import { shouldSkipDuesEnforcement } from "@/lib/dues-enforcement-access";
import { committeeSelfServiceError, isResidentRole } from "@/lib/roles";
import { assertFlatDuesClear } from "@society/db";
import { NextRequest, NextResponse } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/parking/marketplace";
const NEST_GET = "/api/v1/operations/parking/marketplace/list";
const NEST_POST = "/api/v1/operations/parking/marketplace/list-spot";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const shares = await prisma.parkingSharing.findMany({
      where: { 
        societyId: session!.societyId,
        status: "available",
        date: { gte: new Date(new Date().setHours(0,0,0,0)) }
      },
      include: {
        flat: true,
        slot: true,
        ownerOccupancy: { include: { person: true, unit: true } },
        requests: { where: { status: "pending" }, include: { requesterFlat: true } },
      },
      orderBy: { date: "asc" }
    });

    const requests = await prisma.parkingRequest.findMany({
      where: { 
        societyId: session!.societyId,
        status: "pending",
        date: { gte: new Date(new Date().setHours(0,0,0,0)) }
      },
      include: { requesterFlat: true, vehicle: true, requesterOccupancy: { include: { person: true, unit: true } } },
      orderBy: { date: "asc" }
    });

    const context = await getOccupancyContext(session);
    return NextResponse.json({
      shares: shares.map((share) => ({
        ...share,
        canManage: share.ownerOccupancyId === context?.occupancy?.id,
      })),
      requests: requests.map((request) => ({
        ...request,
        canManage: request.requesterOccupancyId === context?.occupancy?.id,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch marketplace" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const committeeError = committeeSelfServiceError(session.role);
  if (committeeError) {
    return NextResponse.json({ error: committeeError }, { status: 403 });
  }
  if (!isResidentRole(session.role) || !session.flatId) {
    return NextResponse.json({ error: "Only flat members can manage parking exchange" }, { status: 401 });
  }

  try {
    const { requestId, sharingId, action, date, endDate, startTime, endTime, description, purpose, contactPhone, isPaid, price } = await request.json();

    if (action === "cancel_share" && sharingId) {
      const context = await getOccupancyContext(session);
      const share = await prisma.parkingSharing.findFirst({
        where: { id: sharingId, societyId: session.societyId },
      });
      if (!share) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      if (share.ownerOccupancyId && share.ownerOccupancyId !== context?.occupancy?.id) {
        return NextResponse.json({ error: "You can cancel only your own listing" }, { status: 403 });
      }
      await prisma.parkingSharing.update({
        where: { id: sharingId },
        data: { status: "cancelled", archivedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "edit_share" && sharingId) {
      const context = await getOccupancyContext(session);
      const share = await prisma.parkingSharing.findFirst({
        where: { id: sharingId, societyId: session.societyId },
      });
      if (!share) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      if (share.ownerOccupancyId !== context?.occupancy?.id) {
        return NextResponse.json({ error: "You can edit only your own listing" }, { status: 403 });
      }
      const dateObj = date ? new Date(date) : share.date;
      const parsedEndDate = parseParkingEndDate(dateObj, endDate || share.endDate);
      const conflict = await findParkingOverlap({
        societyId: session.societyId,
        date: dateObj,
        endDate: parsedEndDate,
        startTime: startTime || share.startTime,
        endTime: endTime || share.endTime,
        slotId: share.slotId,
        assignmentId: share.assignmentId,
      });
      if (conflict && conflict.id !== share.id) {
        return NextResponse.json({ error: "This parking slot is already shared for an overlapping time" }, { status: 400 });
      }
      const updated = await prisma.parkingSharing.update({
        where: { id: sharingId },
        data: {
          date: dateObj,
          endDate: parsedEndDate,
          startTime: startTime || share.startTime,
          endTime: endTime || share.endTime,
          description: description ?? share.description,
          contactPhone: contactPhone ?? share.contactPhone,
          isPaid: isPaid !== undefined ? !!isPaid : share.isPaid,
          price: price !== undefined ? parseFloat(price) || 0 : share.price,
        },
      });
      return NextResponse.json(updated);
    }

    if (action === "cancel_request" && requestId) {
      const context = await getOccupancyContext(session);
      const parkingRequest = await prisma.parkingRequest.findFirst({
        where: { id: requestId, societyId: session.societyId },
      });
      if (!parkingRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 });
      if (parkingRequest.requesterOccupancyId && parkingRequest.requesterOccupancyId !== context?.occupancy?.id) {
        return NextResponse.json({ error: "You can cancel only your own request" }, { status: 403 });
      }
      await prisma.parkingRequest.update({
        where: { id: requestId },
        data: { status: "cancelled", cancelledAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "edit_request" && requestId) {
      const context = await getOccupancyContext(session);
      const parkingRequest = await prisma.parkingRequest.findFirst({
        where: { id: requestId, societyId: session.societyId },
      });
      if (!parkingRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 });
      if (parkingRequest.requesterOccupancyId !== context?.occupancy?.id) {
        return NextResponse.json({ error: "You can edit only your own request" }, { status: 403 });
      }
      const dateObj = date ? new Date(date) : parkingRequest.date;
      const updated = await prisma.parkingRequest.update({
        where: { id: requestId },
        data: {
          date: dateObj,
          endDate: parseParkingEndDate(dateObj, endDate || parkingRequest.endDate),
          startTime: startTime || parkingRequest.startTime,
          endTime: endTime || parkingRequest.endTime,
          purpose: purpose ?? description ?? parkingRequest.purpose,
          contactPhone: contactPhone ?? parkingRequest.contactPhone,
        },
      });
      return NextResponse.json(updated);
    }

    if (!requestId || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid exchange action" }, { status: 400 });
    }

    const context = await getOccupancyContext(session);
    const parkingRequest = await prisma.parkingRequest.findFirst({
      where: { id: requestId, societyId: session.societyId },
      include: { sharing: true },
    });

    if (!parkingRequest?.sharing) {
      return NextResponse.json({ error: "Linked parking listing not found" }, { status: 404 });
    }
    const sharing = parkingRequest.sharing;

    if (sharing.ownerOccupancyId !== context?.occupancy?.id) {
      return NextResponse.json({ error: "Only listing owner can respond" }, { status: 403 });
    }

    if (action === "reject") {
      const updated = await prisma.parkingRequest.update({
        where: { id: requestId },
        data: { status: "rejected", rejectedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    const conflict = await findParkingOverlap({
      societyId: session.societyId,
      date: parkingRequest.date,
      endDate: parkingRequest.endDate,
      startTime: parkingRequest.startTime,
      endTime: parkingRequest.endTime,
      slotId: sharing.slotId,
      assignmentId: sharing.assignmentId,
    });

    if (conflict && conflict.id !== sharing.id) {
      return NextResponse.json({ error: "This slot now has an overlapping booking" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const accepted = await tx.parkingRequest.update({
        where: { id: requestId },
        data: { status: "accepted", acceptedAt: new Date() },
      });
      await tx.parkingSharing.update({
        where: { id: parkingRequest.sharingId! },
        data: { status: "booked" },
      });
      await tx.parkingRequest.updateMany({
        where: {
          sharingId: parkingRequest.sharingId,
          id: { not: requestId },
          status: "pending",
        },
        data: { status: "rejected", rejectedAt: new Date() },
      });
      if (sharing.slotId) {
        await tx.parkingTransactionHistory.create({
          data: {
            societyId: session.societyId,
            slotId: sharing.slotId,
            assignmentId: sharing.assignmentId,
            action: "ACCEPTED",
            actorUserId: session.userId,
            notes: "Parking exchange request accepted",
          },
        });
      }
      return accepted;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Marketplace PATCH error:", error);
    return NextResponse.json({ error: "Failed to update parking exchange" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const committeeError = committeeSelfServiceError(session.role);
  if (committeeError) {
    return NextResponse.json({ error: committeeError }, { status: 403 });
  }
  if (!isResidentRole(session.role) || !session.flatId) {
    return NextResponse.json({ error: "Only flat members can share or request parking" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, date, endDate, startTime, endTime, price, isPaid, description, purpose, vehicleId, urgency, sharingId, contactPhone } = body;
    const context = await getOccupancyContext(session);
    const occupancy = context?.occupancy;

    if (type === "share") {
      if (!occupancy) {
        return NextResponse.json({ error: "Active occupancy is required to share parking" }, { status: 400 });
      }
      const assignment = await prisma.parkingAssignment.findFirst({
        where: {
          societyId: session.societyId,
          unitOccupancyId: occupancy.id,
          status: "ACTIVE",
        },
        include: { slot: true },
      });

      if (!assignment) {
        return NextResponse.json({ error: "No active parking assignment found to share" }, { status: 400 });
      }

      const dateObj = new Date(date);
      const parsedEndDate = parseParkingEndDate(dateObj, endDate);
      const conflict = await findParkingOverlap({
        societyId: session.societyId,
        date: dateObj,
        endDate: parsedEndDate,
        startTime,
        endTime,
        slotId: assignment.slotId,
        assignmentId: assignment.id,
      });

      if (conflict) {
        return NextResponse.json({ error: "This parking slot is already shared for an overlapping time" }, { status: 400 });
      }

      const share = await prisma.parkingSharing.create({
        data: {
          societyId: session!.societyId,
          flatId: session.flatId,
          slotId: assignment.slotId,
          assignmentId: assignment.id,
          ownerOccupancyId: occupancy.id,
          date: dateObj,
          endDate: parsedEndDate,
          startTime,
          endTime,
          isPaid: !!isPaid,
          price: parseFloat(price) || 0,
          description,
          contactPhone: contactPhone || context?.person?.phone || null,
          status: "available"
        }
      });
      return NextResponse.json(share);
    } else {
      if (!occupancy) {
        return NextResponse.json({ error: "Active occupancy is required to request parking" }, { status: 400 });
      }
      if (!shouldSkipDuesEnforcement(session.role)) {
        try {
          await assertFlatDuesClear({
            societyId: session.societyId,
            flatId: session.flatId,
            feature: "guest_parking",
          });
        } catch (error) {
          return NextResponse.json(
            {
              error: error instanceof Error ? error.message : "Dues enforcement blocked guest parking",
              code: "DUES_ENFORCEMENT",
            },
            { status: 403 },
          );
        }
      }
      if (sharingId) {
        const share = await prisma.parkingSharing.findFirst({
          where: { id: sharingId, societyId: session.societyId, status: "available" },
        });
        if (!share) {
          return NextResponse.json({ error: "Parking listing is no longer available" }, { status: 400 });
        }
        if (share.ownerOccupancyId === occupancy.id) {
          return NextResponse.json({ error: "You cannot request your own parking listing" }, { status: 400 });
        }
      }
      const req = await prisma.parkingRequest.create({
        data: {
          societyId: session!.societyId,
          requesterFlatId: session.flatId,
          requesterOccupancyId: occupancy.id,
          vehicleId: vehicleId || null,
          sharingId: sharingId || null,
          date: new Date(date),
          endDate: parseParkingEndDate(new Date(date), endDate),
          startTime,
          endTime,
          purpose,
          contactPhone: contactPhone || context?.person?.phone || null,
          urgency: urgency || "normal",
          status: "pending"
        }
      });
      return NextResponse.json(req);
    }
  } catch (error) {
    console.error("Marketplace POST error:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/parking", nestPath: "/api/v1/operations/parking", method: "GET" }, legacyGET);
export const PATCH = shimOrFallback({ legacyRoute: "/api/parking", nestPath: "/api/v1/operations/parking", method: "PATCH" }, legacyPATCH);
export const POST = shimOrFallback({ legacyRoute: "/api/parking", nestPath: "/api/v1/operations/parking", method: "POST" }, legacyPOST);
