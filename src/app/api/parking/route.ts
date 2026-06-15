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

function buildNextSlotNumber(slots: Array<{ slotNumber: string }>, wing?: string | null) {
  const prefix = wing ? `${wing.toUpperCase()}-P` : "P";
  const max = slots.reduce((currentMax, slot) => {
    const match = slot.slotNumber.match(/(\d+)$/);
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

const LEGACY_ROUTE = "/api/parking";
const NEST_GET = "/api/v1/operations/parking/list";
const NEST_POST = "/api/v1/operations/parking/assign";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slots = await prisma.parkingSlot.findMany({
    where: { societyId: session!.societyId, status: { not: "RETIRED" } },
    include: {
      flat: true,
      zone: true,
      assignments: {
        where: { status: "ACTIVE" },
        include: { vehicle: true, unitOccupancy: { include: { person: true, unit: true } } },
        take: 1,
      },
    },
    orderBy: { slotNumber: "asc" },
  });

  const stats = {
    total: slots.length,
    assigned: slots.filter((s) => s.isAssigned).length,
    available: slots.filter((s) => !s.isAssigned).length,
  };

  const activeOccupancies = await prisma.unitOccupancy.findMany({
    where: {
      societyId: session.societyId,
      isActive: true,
      occupancyStatus: "ACTIVE",
      relationshipType: { in: ["OWNER", "CO_OWNER", "TENANT"] },
    },
    include: {
      person: true,
      unit: {
        include: {
          legacyFlat: true,
          occupancies: {
            where: { isActive: true, occupancyStatus: "ACTIVE" },
            include: { person: true },
          },
        },
      },
    },
    orderBy: [{ unit: { flatNumber: "asc" } }, { isPrimaryOccupant: "desc" }],
  });

  return Response.json({
    slots: slots.map((slot) => {
      const assignment = slot.assignments[0];
      return {
        ...slot,
        currentAssignment: assignment || null,
        isAssigned: Boolean(assignment) || slot.isAssigned,
        vehicleNo: assignment?.vehicle?.registrationNumber || slot.vehicleNo,
        flat: slot.flat || assignment?.unitOccupancy?.unit || null,
      };
    }),
    stats,
    nextSlotNumber: buildNextSlotNumber(slots),
    assignableOccupancies: activeOccupancies.map((occupancy) => {
      const owner = occupancy.unit.occupancies.find((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
      const tenant = occupancy.unit.occupancies.find((item) => item.relationshipType === "TENANT");
      const ownerName = owner?.person.name || occupancy.unit.legacyFlat?.ownerName || null;
      const occupantType = occupancy.relationshipType === "TENANT" ? "Tenant" : occupancy.relationshipType === "CO_OWNER" ? "Co-owner" : "Owner";
      return {
        occupancyId: occupancy.id,
        personId: occupancy.personId,
        unitId: occupancy.unitId,
        flatId: occupancy.unit.legacyFlatId,
        flatNumber: occupancy.unit.flatNumber,
        wing: occupancy.unit.wing,
        name: occupancy.person.name,
        phone: occupancy.person.phone,
        relationshipType: occupancy.relationshipType,
        ownerName,
        tenantName: tenant?.person.name || null,
        occupancyStatus: occupancy.unit.occupancyStatus,
        label: `${occupancy.unit.flatNumber} · ${occupancy.person.name} (${occupantType}${occupancy.relationshipType === "TENANT" && ownerName ? `, Owner: ${ownerName}` : ""})`,
      };
    }),
  });
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slotNumber, slotType, wing, flatNumber, vehicleNo, zoneId, level, occupancyId } = body;

    if (!slotNumber) {
      return Response.json({ error: "Slot number is required" }, { status: 400 });
    }

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
      const createdSlot = await tx.parkingSlot.create({
        data: {
          societyId: session!.societyId,
          slotNumber,
          slotType: String(slotType || "CAR").toUpperCase(),
          zoneId: zoneId || null,
          level: level || null,
          wing: wing || null,
          flatId,
          isAssigned: !!activeOccupancy,
          vehicleNo: vehicleNo || null,
        },
      });

      if (activeOccupancy) {
        const vehicle = vehicleNo
          ? await tx.vehicle.upsert({
              where: {
                societyId_registrationNumber: {
                  societyId: session.societyId,
                  registrationNumber: String(vehicleNo).trim().toUpperCase(),
                },
              },
              create: {
                societyId: session.societyId,
                personId: activeOccupancy.personId,
                registrationNumber: String(vehicleNo).trim().toUpperCase(),
                vehicleType: String(slotType || "CAR").toUpperCase(),
              },
              update: { personId: activeOccupancy.personId, isActive: true },
            })
          : null;

        const assignment = await tx.parkingAssignment.create({
          data: {
            societyId: session.societyId,
            slotId: createdSlot.id,
            vehicleId: vehicle?.id || null,
            unitOccupancyId: activeOccupancy.id,
            assignmentType: activeOccupancy.relationshipType === "TENANT" ? "TENANT" : "OWNER",
            assignedBy: session.userId,
          },
        });

        await tx.parkingTransactionHistory.create({
          data: {
            societyId: session.societyId,
            slotId: createdSlot.id,
            assignmentId: assignment.id,
            action: "ASSIGNED",
            actorUserId: session.userId,
          },
        });
      }

      return createdSlot;
    });

    return Response.json({ slot }, { status: 201 });
  } catch {
    return Response.json({ error: "Slot number may already exist" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/parking", nestPath: "/api/v1/operations/parking", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/parking", nestPath: "/api/v1/operations/parking", method: "POST" }, legacyPOST);
