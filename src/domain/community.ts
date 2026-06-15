import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { ensureUnitForFlat } from "./unit-migration";

type TimeWindow = {
  date: Date;
  endDate?: Date | null;
  startTime: string;
  endTime: string;
};

export function windowsOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}

export async function getOccupancyContext(session: SessionPayload) {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      person: {
        include: {
          occupancies: {
            where: { isActive: true, occupancyStatus: "ACTIVE" },
            include: { unit: { include: { legacyFlat: true } } },
            orderBy: [{ isPrimaryOccupant: "desc" }, { createdAt: "desc" }],
          },
        },
      },
      flat: true,
    },
  });

  if (!user) return null;

  if (user.person?.occupancies[0]) {
    return {
      user,
      person: user.person,
      occupancy: user.person.occupancies[0],
      unit: user.person.occupancies[0].unit,
      flat: user.person.occupancies[0].unit.legacyFlat || user.flat,
    };
  }

  if (user.flat) {
    const unit = await ensureUnitForFlat(user.flat);
    return { user, person: user.person, occupancy: null, unit, flat: user.flat };
  }

  return { user, person: user.person, occupancy: null, unit: null, flat: null };
}

export async function ensureAmenityForFacility(facilityId: string) {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) return null;
  if (facility.amenityId) {
    return prisma.amenity.findUnique({ where: { id: facility.amenityId } });
  }

  const amenity = await prisma.amenity.create({
    data: {
      societyId: facility.societyId,
      name: facility.name,
      description: facility.description,
      capacity: facility.capacity,
      ratePerHour: facility.ratePerHour,
      rules: facility.rules,
      status: facility.isActive ? "ACTIVE" : "DISABLED",
    },
  });

  await prisma.facility.update({ where: { id: facility.id }, data: { amenityId: amenity.id } });
  return amenity;
}

export async function assertAmenityBookable(amenityId: string, window: TimeWindow) {
  const policy = await prisma.amenityPolicy.findFirst({
    where: { amenityId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (policy?.bookingWindowDays) {
    const latestAllowed = new Date();
    latestAllowed.setDate(latestAllowed.getDate() + policy.bookingWindowDays);
    if (window.date > latestAllowed) {
      return `Bookings are allowed only ${policy.bookingWindowDays} days in advance`;
    }
  }

  const blackout = await prisma.amenitySchedule.findFirst({
    where: {
      amenityId,
      isActive: true,
      scheduleType: { in: ["BLACKOUT", "MAINTENANCE"] },
      OR: [{ date: window.date }, { dayOfWeek: window.date.getDay(), date: null }],
    },
  });

  if (blackout && windowsOverlap(window.startTime, window.endTime, blackout.startTime, blackout.endTime)) {
    return "Amenity is blocked for maintenance during this time";
  }

  return null;
}

export async function findParkingOverlap(params: {
  societyId: string;
  date: Date;
  endDate?: Date | null;
  startTime: string;
  endTime: string;
  slotId?: string | null;
  assignmentId?: string | null;
}) {
  const endDate = params.endDate || params.date;
  return prisma.parkingSharing.findFirst({
    where: {
      societyId: params.societyId,
      status: { in: ["available", "booked"] },
      date: { lte: endDate },
      OR: [
        { endDate: null, date: { gte: params.date } },
        { endDate: { gte: params.date } },
      ],
      AND: [
        {
          OR: [
            ...(params.assignmentId ? [{ assignmentId: params.assignmentId }] : []),
            ...(params.slotId ? [{ slotId: params.slotId }] : []),
          ],
        },
        { startTime: { lt: params.endTime } },
        { endTime: { gt: params.startTime } },
      ],
    },
  });
}

export function parseParkingEndDate(date: Date, value: unknown) {
  if (!value) return date;
  const endDate = new Date(String(value));
  if (Number.isNaN(endDate.getTime())) return date;
  return endDate < date ? date : endDate;
}

export async function expireParkingAssignmentsForOccupancy(unitOccupancyId: string, actorUserId?: string) {
  const assignments = await prisma.parkingAssignment.findMany({
    where: { unitOccupancyId, status: "ACTIVE" },
  });

  for (const assignment of assignments) {
    await prisma.parkingAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "REVIEW_REQUIRED",
        endDate: new Date(),
        archivedAt: new Date(),
        notes: [assignment.notes, "Occupancy archived; assignment needs review"].filter(Boolean).join("\n"),
      },
    });

    await prisma.parkingSlot.update({
      where: { id: assignment.slotId },
      data: { isAssigned: false, flatId: null, vehicleNo: null },
    });

    await prisma.parkingTransactionHistory.create({
      data: {
        societyId: assignment.societyId,
        slotId: assignment.slotId,
        assignmentId: assignment.id,
        action: "REVIEW_REQUIRED",
        actorUserId,
        notes: "Occupancy archived",
      },
    });
  }

  return assignments.length;
}
