import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureUnitsForSociety } from "@/domain/unit-migration";
import { NextRequest } from "next/server";

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFlatNumber(wing: string, floor: number, unit: number, flatsPerFloor: number) {
  const unitWidth = Math.max(2, String(flatsPerFloor).length);
  return `${wing}-${floor}${String(unit).padStart(unitWidth, "0")}`;
}

export async function GET() {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUnitsForSociety(session.societyId);

  const units = await prisma.unit.findMany({
    where: { societyId: session.societyId },
    select: {
      id: true,
      legacyFlatId: true,
      flatNumber: true,
      wing: true,
      floor: true,
      occupancyStatus: true,
      billingStatus: true,
      isActive: true,
      legacyFlat: {
        select: {
          ownerName: true,
          contact: true,
          users: { select: { id: true, role: true, name: true, email: true, phone: true } },
        },
      },
      occupancies: {
        where: { isActive: true, occupancyStatus: "ACTIVE" },
        include: {
          person: { select: { id: true, name: true, phone: true, users: { select: { id: true, role: true, email: true } } } },
        },
      },
    },
    orderBy: [{ wing: "asc" }, { floor: "asc" }, { flatNumber: "asc" }],
  });

  return Response.json({
    flats: units.map((unit) => {
      const ownerOccupancy = unit.occupancies.find((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
      const tenantOccupancy = unit.occupancies.find((item) => item.relationshipType === "TENANT");
      const legacyUsers = unit.legacyFlat?.users || [];
      const member = legacyUsers.find((user) => user.role === "member");
      const tenant = legacyUsers.find((user) => user.role === "tenant");
      const users = unit.occupancies.flatMap((occupancy) => {
        const authUser = occupancy.person.users[0];
        return {
          id: authUser?.id || occupancy.person.id,
          role: authUser?.role || occupancy.relationshipType.toLowerCase(),
          name: occupancy.person.name,
          email: authUser?.email || "",
          phone: occupancy.person.phone,
        };
      });
      return {
        id: unit.legacyFlatId || unit.id,
        unitId: unit.id,
        flatNumber: unit.flatNumber,
        wing: unit.wing,
        floor: unit.floor,
        isActive: unit.isActive,
        occupancyStatus: unit.occupancyStatus,
        billingStatus: unit.billingStatus,
        ownerName: ownerOccupancy?.person.name || unit.legacyFlat?.ownerName || member?.name || null,
        tenantName: tenantOccupancy?.person.name || tenant?.name || null,
        contact: ownerOccupancy?.person.phone || unit.legacyFlat?.contact || member?.phone || null,
        users: users.length ? users : legacyUsers,
        hasAccount: users.length > 0 || legacyUsers.length > 0,
      };
    }),
    total: units.length,
    active: units.filter((unit) => unit.isActive).length,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const wings = parseCsv(String(body.wings || ""));
    const floors = parseCsv(String(body.floors || "")).map(Number).filter(Number.isFinite);
    const flatsPerFloor = Number(body.flatsPerFloor || 0);

    if (!wings.length || !floors.length || flatsPerFloor < 1 || flatsPerFloor > 50) {
      return Response.json(
        { error: "Enter wings, floors, and flats per floor correctly" },
        { status: 400 }
      );
    }

    const candidates = new Map<string, { flatNumber: string; wing: string; floor: number }>();
    for (const wing of wings) {
      for (const floor of floors) {
        for (let unit = 1; unit <= flatsPerFloor; unit++) {
          const flatNumber = buildFlatNumber(wing.toUpperCase(), floor, unit, flatsPerFloor);
          candidates.set(`${wing}:${flatNumber}`, {
            flatNumber,
            wing: wing.toUpperCase(),
            floor,
          });
        }
      }
    }

    const flatNumbers = Array.from(candidates.values()).map((flat) => flat.flatNumber);
    const existing = await prisma.flat.findMany({
      where: { societyId: session.societyId, flatNumber: { in: flatNumbers } },
      select: { flatNumber: true },
    });
    const existingNumbers = new Set(existing.map((flat) => flat.flatNumber));
    const createData = Array.from(candidates.values())
      .filter((flat) => !existingNumbers.has(flat.flatNumber))
      .map((flat) => ({
        societyId: session.societyId,
        flatNumber: flat.flatNumber,
        wing: flat.wing,
        floor: flat.floor,
      }));

    if (createData.length) {
      await prisma.flat.createMany({ data: createData });
    }
    await ensureUnitsForSociety(session.societyId);

    const activeCount = await prisma.flat.count({
      where: { societyId: session.societyId, isActive: true },
    });
    await prisma.society.update({
      where: { id: session.societyId },
      data: { totalFlats: activeCount },
    });

    return Response.json({
      created: createData.length,
      skipped: existing.length,
      totalRequested: candidates.size,
    });
  } catch (error) {
    console.error("Flat setup error:", error);
    return Response.json({ error: "Could not create flats" }, { status: 500 });
  }
}
