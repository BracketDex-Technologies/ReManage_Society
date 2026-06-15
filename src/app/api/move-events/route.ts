import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { ensureUnitForFlat } from "@/domain/unit-migration";
import { moveOutOccupancy } from "@/domain/occupancy-lifecycle";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/move-events";
const NEST_GET = "/api/v1/society-core/occupancy/move-events/list";
const NEST_POST = "/api/v1/society-core/occupancy/move-events/create";

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const events = await prisma.moveEvent.findMany({
      where: { societyId: session!.societyId },
      include: { flat: { select: { flatNumber: true, wing: true, ownerName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(events);
  } catch {
    return Response.json({ error: "Failed to fetch move events" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { flatId, type, residentName, residentType, notes } = await request.json();

    if (!flatId || !type || !residentName || !residentType) {
      return Response.json({ error: "All fields required" }, { status: 400 });
    }

    // Default checklist based on type
    const moveInChecklist = [
      { item: "Society NOC obtained", status: "pending" },
      { item: "Police verification submitted", status: "pending" },
      { item: "Key deposit paid", status: "pending" },
      { item: "Parking slot assigned", status: "pending" },
      { item: "Society app access created", status: "pending" },
      { item: "Maintenance billing started", status: "pending" },
    ];

    const moveOutChecklist = [
      { item: "All dues cleared", status: "pending" },
      { item: "Keys returned", status: "pending" },
      { item: "Parking slot released", status: "pending" },
      { item: "App access revoked", status: "pending" },
      { item: "NOC issued", status: "pending" },
      { item: "Security deposit refunded", status: "pending" },
    ];

    const checklist = type === "move_in" ? moveInChecklist : moveOutChecklist;

    const event = await prisma.moveEvent.create({
      data: {
        flatId,
        societyId: session!.societyId,
        type,
        residentName,
        residentType,
        checklist: JSON.stringify(checklist),
        initiatedBy: session.userId,
        notes: notes || null,
      },
      include: { flat: { select: { flatNumber: true, wing: true } } },
    });

    return Response.json(event);
  } catch {
    return Response.json({ error: "Failed to create move event" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session!.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId, checklistIndex, status: itemStatus, approvedBy, eventStatus } = await request.json();

    const event = await prisma.moveEvent.findFirst({
      where: { id: eventId, societyId: session!.societyId },
    });

    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // Update checklist item
    if (checklistIndex !== undefined && itemStatus) {
      const checklist = JSON.parse(event.checklist || "[]");
      if (checklist[checklistIndex]) {
        checklist[checklistIndex].status = itemStatus;
        checklist[checklistIndex].completedBy = session.name;
        checklist[checklistIndex].completedAt = new Date().toISOString();
      }

      const allCompleted = checklist.every((c: { status: string }) => c.status === "completed");

      const updated = await prisma.moveEvent.update({
        where: { id: eventId },
        data: {
          checklist: JSON.stringify(checklist),
          status: allCompleted ? "completed" : "in_progress",
          completedAt: allCompleted ? new Date() : null,
          approvedBy: approvedBy || null,
        },
      });

      return Response.json(updated);
    }

    // Update event status directly
    if (eventStatus) {
      const updated = await prisma.moveEvent.update({
        where: { id: eventId },
        data: {
          status: eventStatus,
          approvedBy: session.userId,
          completedAt: eventStatus === "completed" ? new Date() : null,
        },
      });

      if (eventStatus === "completed" && event.type === "move_out") {
        const flat = await prisma.flat.findUnique({ where: { id: event.flatId } });
        if (flat) {
          const unit = await ensureUnitForFlat(flat);
          const occupancy = await prisma.unitOccupancy.findFirst({
            where: {
              unitId: unit.id,
              isActive: true,
              occupancyStatus: "ACTIVE",
              person: { name: { equals: event.residentName, mode: "insensitive" } },
              relationshipType: event.residentType.toUpperCase() === "TENANT" ? "TENANT" : undefined,
            },
            orderBy: { createdAt: "desc" },
          });

          if (occupancy) {
            await moveOutOccupancy(occupancy.id, updated.completedAt || new Date());
          }
        }
      }

      return Response.json(updated);
    }

    return Response.json({ error: "No update action specified" }, { status: 400 });
  } catch {
    return Response.json({ error: "Failed to update move event" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/move-events", nestPath: "/api/v1/society-core/occupancy", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/move-events", nestPath: "/api/v1/society-core/occupancy", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/move-events", nestPath: "/api/v1/society-core/occupancy", method: "PATCH" }, legacyPATCH);
