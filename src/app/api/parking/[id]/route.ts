import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { ensureUnitForFlat } from "@/domain/unit-migration";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/parking/[id]";
const NEST_PATCH = "/api/v1/operations/parking/detail/update";
const NEST_DELETE = "/api/v1/operations/parking/detail/remove";

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
    const { flatNumber, vehicleNo, isAssigned, occupancyId } = body;

    let flatId = null;
    let activeOccupancy = occupancyId
      ? await prisma.unitOccupancy.findFirst({
          where: {
            id: occupancyId,
            societyId: session.societyId,
            isActive: true,
            occupancyStatus: "ACTIVE",
          },
          include: { person: true, unit: true },
        })
      : null;
    if (activeOccupancy?.unit.legacyFlatId) {
      flatId = activeOccupancy.unit.legacyFlatId;
    } else if (flatNumber) {
      const flat = await prisma.flat.findFirst({
        where: { societyId: session!.societyId, flatNumber },
      });
      flatId = flat?.id || null;
      if (flat) {
        const unit = await ensureUnitForFlat(flat);
        activeOccupancy = await prisma.unitOccupancy.findFirst({
          where: {
            societyId: session.societyId,
            unitId: unit.id,
            isActive: true,
            occupancyStatus: "ACTIVE",
            relationshipType: { in: ["OWNER", "CO_OWNER", "TENANT"] },
          },
          include: { person: true, unit: true },
          orderBy: [{ isPrimaryOccupant: "desc" }, { createdAt: "desc" }],
        });
      }
    }

    const slot = await prisma.$transaction(async (tx) => {
      const existing = await tx.parkingSlot.findFirst({ where: { id, societyId: session.societyId } });
      if (!existing) throw new Error("Slot not found");

      await tx.parkingAssignment.updateMany({
        where: { slotId: id, status: "ACTIVE" },
        data: {
          status: isAssigned === false ? "ARCHIVED" : "REVIEW_REQUIRED",
          endDate: new Date(),
          archivedAt: new Date(),
        },
      });

      let assignmentId: string | null = null;
      let normalizedVehicleNo: string | null = null;

      if (isAssigned !== false && activeOccupancy) {
        normalizedVehicleNo = vehicleNo ? String(vehicleNo).trim().toUpperCase() : null;
        const vehicle = normalizedVehicleNo
          ? await tx.vehicle.upsert({
              where: {
                societyId_registrationNumber: {
                  societyId: session.societyId,
                  registrationNumber: normalizedVehicleNo,
                },
              },
              create: {
                societyId: session.societyId,
                personId: activeOccupancy.personId,
                registrationNumber: normalizedVehicleNo,
                vehicleType: existing.slotType,
              },
              update: { personId: activeOccupancy.personId, isActive: true },
            })
          : null;

        const assignment = await tx.parkingAssignment.create({
          data: {
            societyId: session.societyId,
            slotId: id,
            vehicleId: vehicle?.id || null,
            unitOccupancyId: activeOccupancy.id,
            assignmentType: activeOccupancy.relationshipType === "TENANT" ? "TENANT" : "OWNER",
            assignedBy: session.userId,
          },
        });
        assignmentId = assignment.id;
      }

      const updatedSlot = await tx.parkingSlot.update({
        where: { id },
        data: {
          flatId: isAssigned === false ? null : flatId,
          isAssigned: Boolean(activeOccupancy) && isAssigned !== false,
          vehicleNo: isAssigned === false ? null : normalizedVehicleNo,
        },
      });

      await tx.parkingTransactionHistory.create({
        data: {
          societyId: session.societyId,
          slotId: id,
          assignmentId,
          action: isAssigned === false ? "ARCHIVED" : "ASSIGNED",
          actorUserId: session.userId,
        },
      });

      return updatedSlot;
    });
    return Response.json({ slot });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function legacyDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.$transaction(async (tx) => {
    await tx.parkingAssignment.updateMany({
      where: { slotId: id, status: "ACTIVE" },
      data: { status: "ARCHIVED", endDate: new Date(), archivedAt: new Date() },
    });
    await tx.parkingSlot.update({
      where: { id },
      data: { status: "RETIRED", isAssigned: false, flatId: null, vehicleNo: null },
    });
    await tx.parkingTransactionHistory.create({
      data: {
        societyId: session.societyId,
        slotId: id,
        action: "ARCHIVED",
        actorUserId: session.userId,
        notes: "Slot retired from UI delete action",
      },
    });
  });
  return Response.json({ success: true });
}

export const PATCH = shimOrFallback({ legacyRoute: "/api/parking", nestPath: "/api/v1/operations/parking", method: "PATCH" }, legacyPATCH);
export const DELETE = shimOrFallback({ legacyRoute: "/api/parking", nestPath: "/api/v1/operations/parking", method: "DELETE" }, legacyDELETE);
