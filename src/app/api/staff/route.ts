import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getResidentFlatForSession,
  isResidentRole,
  isStaffManagerRole,
} from "@/lib/resident-flat";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/staff";
const NEST_GET = "/api/v1/operations/staff/list";
const NEST_POST = "/api/v1/operations/staff/create";

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where: {
      societyId: string;
      flatLinks?: { some: { flatId: string; isActive: true } };
    } = { societyId: session.societyId };

    if (isResidentRole(session.role)) {
      const flat = await getResidentFlatForSession(session);
      if (!flat) {
        return Response.json([]);
      }
      where.flatLinks = { some: { flatId: flat.id, isActive: true } };
    }

    const staff = await prisma.domesticStaff.findMany({
      where,
      include: {
        flatLinks: {
          where: { isActive: true },
          include: { flat: { select: { flatNumber: true, wing: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(staff);
  } catch {
    return Response.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, phone, category, photoUrl, idProofType, idProofUrl, flatIds, schedule, agreedMonthlyPay } =
      await request.json();

    if (!name || !phone || !category) {
      return Response.json({ error: "Name, phone and category required" }, { status: 400 });
    }

    let linkedFlatIds = Array.isArray(flatIds) ? flatIds.map(String) : [];

    if (isResidentRole(session.role)) {
      const flat = await getResidentFlatForSession(session);
      if (!flat) {
        return Response.json({ error: "No flat linked to this account" }, { status: 400 });
      }
      linkedFlatIds = [flat.id];
    } else if (!isStaffManagerRole(session.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate unique 4-digit entry code
    const entryCode = String(Math.floor(1000 + Math.random() * 9000));
    const monthlyPay = Number(agreedMonthlyPay || 0);

    const staff = await prisma.domesticStaff.create({
      data: {
        societyId: session.societyId,
        name,
        phone,
        category,
        photoUrl: photoUrl || null,
        idProofType: idProofType || null,
        idProofUrl: idProofUrl || null,
        entryCode,
        flatLinks: linkedFlatIds.length
          ? {
              create: linkedFlatIds.map((flatId: string) => ({
                flatId,
                schedule: schedule || null,
                agreedMonthlyPay: Number.isFinite(monthlyPay) && monthlyPay > 0 ? monthlyPay : null,
              })),
            }
          : undefined,
      },
      include: {
        flatLinks: {
          include: { flat: { select: { flatNumber: true, wing: true } } },
        },
      },
    });

    return Response.json(staff);
  } catch {
    return Response.json({ error: "Failed to create staff" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: LEGACY_ROUTE, nestPath: NEST_GET, method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: LEGACY_ROUTE, nestPath: NEST_POST, method: "POST" }, legacyPOST);
