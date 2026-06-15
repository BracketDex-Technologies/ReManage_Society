import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/staff/attendance";
const NEST_GET = "/api/v1/operations/staff/attendance/list";
const NEST_POST = "/api/v1/operations/staff/attendance/record";

async function legacyGET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    const date = searchParams.get("date");

    const where: Record<string, unknown> = { societyId: session!.societyId };
    if (staffId) where.staffId = staffId;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.checkIn = { gte: start, lt: end };
    }

    const attendance = await prisma.staffAttendance.findMany({
      where,
      include: {
        staff: { select: { name: true, category: true, phone: true } },
      },
      orderBy: { checkIn: "desc" },
      take: 100,
    });

    return Response.json(attendance);
  } catch {
    return Response.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { staffId, flatId, method } = await request.json();

    if (!staffId) {
      return Response.json({ error: "Staff ID required" }, { status: 400 });
    }

    // Check if there's an open check-in (no checkout) for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const openEntry = await prisma.staffAttendance.findFirst({
      where: {
        staffId,
        societyId: session!.societyId,
        checkIn: { gte: today, lt: tomorrow },
        checkOut: null,
      },
    });

    if (openEntry) {
      const updated = await prisma.staffAttendance.update({
        where: { id: openEntry.id },
        data: { checkOut: new Date() },
        include: { staff: { select: { name: true, category: true } } },
      });
      return Response.json({ ...updated, action: "checkout" });
    }

    const entry = await prisma.staffAttendance.create({
      data: {
        staffId,
        societyId: session!.societyId,
        flatId: flatId || null,
        method: method || "manual",
        markedBy: session.userId || "system",
      },
      include: { staff: { select: { name: true, category: true } } },
    });

    return Response.json({ ...entry, action: "checkin" });
  } catch {
    return Response.json({ error: "Failed to record attendance" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: LEGACY_ROUTE, nestPath: NEST_GET, method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: LEGACY_ROUTE, nestPath: NEST_POST, method: "POST" }, legacyPOST);
