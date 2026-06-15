import "server-only";
import { prisma } from "@/lib/prisma";
import { occupancyStatusForRelationships } from "./occupancy";
import { expireParkingAssignmentsForOccupancy } from "./community";

export async function refreshUnitOccupancyStatus(unitId: string) {
  const active = await prisma.unitOccupancy.findMany({
    where: { unitId, isActive: true, occupancyStatus: "ACTIVE" },
    select: { relationshipType: true },
  });

  const occupancyStatus = occupancyStatusForRelationships(active.map((item) => item.relationshipType));
  await prisma.unit.update({
    where: { id: unitId },
    data: { occupancyStatus },
  });

  return occupancyStatus;
}

export async function moveOutOccupancy(occupancyId: string, moveOutDate = new Date()) {
  const occupancy = await prisma.unitOccupancy.update({
    where: { id: occupancyId },
    data: {
      isActive: false,
      occupancyStatus: "MOVED_OUT",
      moveOutDate,
    },
  });

  await refreshUnitOccupancyStatus(occupancy.unitId);
  await expireParkingAssignmentsForOccupancy(occupancy.id);
  return occupancy;
}
