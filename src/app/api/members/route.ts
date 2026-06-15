import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureUnitForFlat, ensureUnitsForSociety } from "@/domain/unit-migration";
import { NextRequest } from "next/server";
import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/members";
const NEST_GET = "/api/v1/society-core/members/list";
const NEST_POST = "/api/v1/society-core/members/create";

async function legacyGET(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const wing = searchParams.get("wing") || "";
  const flatsOnly = searchParams.get("flatsOnly") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  await ensureUnitsForSociety(session.societyId);

  const where: Record<string, unknown> = {
    societyId: session.societyId,
  };

  if (search) {
    where.OR = [
      { flatNumber: { contains: search, mode: "insensitive" } },
      { legacyFlat: { ownerName: { contains: search, mode: "insensitive" } } },
      { legacyFlat: { contact: { contains: search } } },
      { occupancies: { some: { person: { name: { contains: search, mode: "insensitive" } } } } },
      { occupancies: { some: { person: { phone: { contains: search } } } } },
    ];
  }

  if (wing) {
    where.wing = wing;
  }

  const [units, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      include: {
        legacyFlat: true,
        occupancies: {
          where: { isActive: true, occupancyStatus: "ACTIVE" },
          include: { person: true },
        },
      },
      orderBy: { flatNumber: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.unit.count({ where }),
  ]);

  const members = units.map((unit) => {
    const owner = unit.occupancies.find((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
    const tenant = unit.occupancies.find((item) => item.relationshipType === "TENANT");
    return {
      id: unit.legacyFlatId || unit.id,
      unitId: unit.id,
      societyId: unit.societyId,
      flatNumber: unit.flatNumber,
      wing: unit.wing,
      floor: unit.floor,
      ownerName: owner?.person.name || unit.legacyFlat?.ownerName || "",
      tenantName: tenant?.person.name || unit.legacyFlat?.tenantName || "",
      contact: owner?.person.phone || unit.legacyFlat?.contact || "",
      email: unit.legacyFlat?.email || "",
      vehicleNumber: unit.legacyFlat?.vehicleNumber || "",
      flatType: unit.unitType,
      currentOccupant:
        unit.occupancyStatus === "TENANT_OCCUPIED"
          ? "tenant"
          : unit.occupancyStatus === "VACANT"
            ? "vacant"
            : "owner",
      occupancyStatus: unit.occupancyStatus,
      isActive: unit.isActive,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  });

  if (flatsOnly) {
    return Response.json({
      flats: members
        .filter((member) => member.isActive && member.currentOccupant !== "tenant")
        .map((member) => ({
          id: member.id,
          unitId: member.unitId,
          flatNumber: member.flatNumber,
          wing: member.wing,
          ownerName: member.ownerName || "Owner not linked",
          tenantName: member.tenantName || "",
          occupancyStatus: member.occupancyStatus,
        })),
    });
  }

  // Get distinct wings
  const wings = await prisma.flat.findMany({
    where: { societyId: session.societyId },
    select: { wing: true },
    distinct: ["wing"],
  });

  return jsonWithHeaders(
    {
      members,
      total,
      pages: Math.ceil(total / limit),
      wings: wings.map((w) => w.wing).filter(Boolean),
    },
    {
      status: 200,
      extraHeaders: buildDeprecationHeaders({
        routePath: "/api/members",
        successorPath: "/api/v1/society-core/directory/read",
      }),
    },
  );
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { flatNumber, wing, floor, ownerName, tenantName, contact, email, vehicleNumber } = body;

    // Validation
    if (!flatNumber || !ownerName || !contact) {
      return Response.json(
        { error: "Flat number, owner name, and contact are required" },
        { status: 400 }
      );
    }

    if (ownerName.length < 2) {
      return Response.json(
        { error: "Owner name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(contact)) {
      return Response.json(
        { error: "Please enter a valid 10-digit mobile number" },
        { status: 400 }
      );
    }

    // Check for duplicate flat number
    const existing = await prisma.flat.findFirst({
      where: { societyId: session!.societyId, flatNumber },
    });

    if (existing) {
      return Response.json(
        { error: `Flat number ${flatNumber} already exists` },
        { status: 400 }
      );
    }

    const member = await prisma.flat.create({
      data: {
        societyId: session!.societyId,
        flatNumber,
        wing: wing || null,
        floor: floor ? parseInt(floor) : null,
        ownerName,
        tenantName: tenantName || null,
        contact,
        email: email || null,
        vehicleNumber: vehicleNumber || null,
      },
    });

    await ensureUnitForFlat(member);

    // Update society totalFlats
    const flatCount = await prisma.flat.count({
      where: { societyId: session!.societyId, isActive: true },
    });
    const society = await prisma.society.update({
      where: { id: session!.societyId },
      data: { totalFlats: flatCount },
    });

    // Automatically create bill for current period if bills already exist for others
    const { getCurrentPeriod } = await import("@/lib/utils");
    const currentPeriod = getCurrentPeriod();
    
    // Check if any bills already exist for THIS society in THIS period
    const billsExist = await prisma.maintenanceBill.findFirst({
      where: { societyId: session!.societyId, period: currentPeriod }
    });

    if (billsExist) {
      const [year, month] = currentPeriod.split("-").map(Number);
      const dueDate = new Date(year, month - 1, society.dueDayOfMonth);
      
      await prisma.maintenanceBill.create({
        data: {
          flatId: member.id,
          societyId: session!.societyId,
          amount: society.maintenanceAmt,
          period: currentPeriod,
          dueDate,
        }
      });
    }

    return Response.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Error creating member:", error);
    return Response.json(
      { error: "Something went wrong — please try again" },
      { status: 500 }
    );
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/members", nestPath: "/api/v1/society-core/directory/read", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/members", nestPath: "/api/v1/society-core/directory/read", method: "POST" }, legacyPOST);
