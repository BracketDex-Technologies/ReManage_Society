import "server-only";
import { prisma } from "@/lib/prisma";

type LegacyFlat = {
  id: string;
  societyId: string;
  flatNumber: string;
  wing: string | null;
  floor: number | null;
  flatType: string | null;
  carpetArea: number | null;
  currentOccupant: string;
  ownerName?: string | null;
  tenantName?: string | null;
  contact?: string | null;
  isActive: boolean;
};

function unitTypeFromFlat(flatType?: string | null) {
  const normalized = String(flatType || "2BHK").toUpperCase();
  if (["1RK", "1BHK", "2BHK", "3BHK", "SHOP", "OFFICE", "PENTHOUSE", "VILLA"].includes(normalized)) {
    return normalized;
  }
  return "2BHK";
}

function occupancyStatusFromLegacy(flat: LegacyFlat) {
  if (flat.currentOccupant === "tenant" && flat.tenantName) return "TENANT_OCCUPIED";
  if (flat.currentOccupant === "vacant") return "VACANT";
  if (flat.ownerName || flat.contact) return "OWNER_OCCUPIED";
  return "VACANT";
}

export async function ensureUnitForFlat(flat: LegacyFlat) {
  const unit = await prisma.unit.upsert({
    where: { legacyFlatId: flat.id },
    create: {
      societyId: flat.societyId,
      legacyFlatId: flat.id,
      wing: flat.wing,
      flatNumber: flat.flatNumber,
      floor: flat.floor,
      unitType: unitTypeFromFlat(flat.flatType),
      usageType: ["SHOP", "OFFICE"].includes(unitTypeFromFlat(flat.flatType)) ? "COMMERCIAL" : "RESIDENTIAL",
      carpetArea: flat.carpetArea,
      occupancyStatus: occupancyStatusFromLegacy(flat),
      isActive: flat.isActive,
    },
    update: {
      wing: flat.wing,
      flatNumber: flat.flatNumber,
      floor: flat.floor,
      unitType: unitTypeFromFlat(flat.flatType),
      carpetArea: flat.carpetArea,
      isActive: flat.isActive,
    },
  });

  const activeOccupancies = await prisma.unitOccupancy.count({
    where: { unitId: unit.id, isActive: true, occupancyStatus: "ACTIVE" },
  });

  if (activeOccupancies === 0 && unit.occupancyStatus !== occupancyStatusFromLegacy(flat)) {
    return prisma.unit.update({
      where: { id: unit.id },
      data: { occupancyStatus: occupancyStatusFromLegacy(flat) },
    });
  }

  return unit;
}

export async function ensureUnitsForSociety(societyId: string) {
  const flats = await prisma.flat.findMany({
    where: { societyId },
    select: {
      id: true,
      societyId: true,
      flatNumber: true,
      wing: true,
      floor: true,
      flatType: true,
      carpetArea: true,
      currentOccupant: true,
      ownerName: true,
      tenantName: true,
      contact: true,
      isActive: true,
    },
  });

  return Promise.all(flats.map((flat) => ensureUnitForFlat(flat)));
}
