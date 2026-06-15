import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/directory";
const NEST_GET = "/api/v1/society-core/directory/read";

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flats = await prisma.flat.findMany({
      where: { societyId: session!.societyId, isActive: true },
      select: {
        id: true,
        flatNumber: true,
        wing: true,
        floor: true,
        ownerName: true,
        tenantName: true,
        contact: true,
        email: true,
        vehicleNumber: true,
        flatType: true,
        currentOccupant: true,
        users: {
          select: {
            name: true,
            phone: true,
            email: true,
            role: true,
            showPhoneInDirectory: true,
            showEmailInDirectory: true,
          },
        },
      },
      orderBy: [{ wing: "asc" }, { flatNumber: "asc" }],
    });

    // Apply privacy filters - members only see what's allowed
    const isAdmin = ["chairman", "secretary", "treasurer"].includes(session!.role);

    const directory = flats.map((flat) => ({
      flatNumber: flat.flatNumber,
      wing: flat.wing,
      floor: flat.floor,
      ownerName: flat.ownerName,
      tenantName: flat.tenantName,
      currentOccupant: flat.currentOccupant,
      flatType: flat.flatType,
      vehicleNumber: flat.vehicleNumber,
      // Show contact only if admin OR user opted in
      contact: isAdmin
        ? flat.contact
        : flat.users.some((u) => u.showPhoneInDirectory)
        ? flat.contact
        : null,
      email: isAdmin
        ? flat.email
        : flat.users.some((u) => u.showEmailInDirectory)
        ? flat.email
        : null,
      members: flat.users.map((u) => ({
        name: u.name,
        role: u.role,
        phone: isAdmin || u.showPhoneInDirectory ? u.phone : null,
        email: isAdmin || u.showEmailInDirectory ? u.email : null,
      })),
    }));

    // Group by wing
    const wings = [...new Set(flats.map((f) => f.wing || "General"))];
    const grouped: Record<string, typeof directory> = {};
    for (const wing of wings) {
      grouped[wing] = directory.filter((f) => (f.wing || "General") === wing);
    }

    return Response.json({
      directory,
      grouped,
      total: flats.length,
      wings,
    });
  } catch {
    return Response.json({ error: "Failed to fetch directory" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/directory", nestPath: "/api/v1/society-core/directory/read", method: "GET" }, legacyGET);
