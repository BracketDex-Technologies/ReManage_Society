import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

// GET - list visitors with pre-approval status
const LEGACY_ROUTE = "/api/visitors/preapprove";
const NEST_POST = "/api/v1/operations/visitors/preapprove/create";

async function legacyGET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const flatNumber = searchParams.get("flat");

    const where: Record<string, unknown> = { societyId: session!.societyId };
    if (status !== "all") where.status = status;
    if (flatNumber) where.flatNumber = flatNumber;

    // Members see only their flat's visitors
    if (["member", "tenant"].includes(session!.role) && session.flatId) {
      where.flatId = session.flatId;
    }

    const visitors = await prisma.visitor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        flat: { select: { flatNumber: true, wing: true, ownerName: true } },
      },
    });

    // Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayFilter = { societyId: session!.societyId, createdAt: { gte: today } };

    const [totalToday, pending, inside] = await Promise.all([
      prisma.visitor.count({ where: todayFilter }),
      prisma.visitor.count({ where: { ...todayFilter, status: "expected", residentResponse: null } }),
      prisma.visitor.count({ where: { societyId: session!.societyId, status: "in" } }),
    ]);

    return Response.json({ visitors, stats: { totalToday, pending, inside } });
  } catch (error) {
    console.error("Visitor list error:", error);
    return Response.json({ error: "Failed to load visitors" }, { status: 500 });
  }
}

// POST - create pre-approved visitor entry
async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { visitorName, phone, purpose, expectedAt, flatNumber, vehicleNo } = body;

    if (!visitorName || !flatNumber) {
      return Response.json({ error: "Visitor name and flat number required" }, { status: 400 });
    }

    // Find flat
    const flat = await prisma.flat.findFirst({
      where: { societyId: session!.societyId, flatNumber },
    });

    // Generate 6-digit passcode
    const passcode = Math.floor(100000 + Math.random() * 900000).toString();

    const visitor = await prisma.visitor.create({
      data: {
        societyId: session!.societyId,
        flatId: flat?.id,
        flatNumber,
        visitorName: visitorName.trim(),
        phone: phone || null,
        purpose: purpose || "guest",
        vehicleNo: vehicleNo || null,
        status: "expected",
        isPreApproved: true,
        expectedAt: expectedAt ? new Date(expectedAt) : null,
        passcode,
        verificationMethod: "pre_approved",
        residentResponse: "approved",
        respondedAt: new Date(),
        approvedBy: session.name,
      },
    });

    // Create notification for the society
    await prisma.notification.create({
      data: {
        societyId: session!.societyId,
        type: "visitor_entry",
        title: "Visitor Pre-Approved",
        message: `${visitorName} pre-approved for Flat ${flatNumber}. Passcode: ${passcode}`,
        link: "/visitors",
      },
    });

    return Response.json({
      visitor,
      passcode,
      message: `Visitor pre-approved. Passcode: ${passcode}`,
    });
  } catch (error) {
    console.error("Pre-approve error:", error);
    return Response.json({ error: "Failed to create" }, { status: 500 });
  }
}

// PATCH - approve/reject a visitor (member responds to guard request)
async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { visitorId, action } = await request.json();
    if (!visitorId || !["approved", "rejected"].includes(action)) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const where: { id: string; societyId: string; flatId?: string } = {
      id: visitorId,
      societyId: session!.societyId,
    };
    if (["member", "tenant"].includes(session.role)) {
      if (!session.flatId) {
        return Response.json({ error: "No flat assigned" }, { status: 400 });
      }
      where.flatId = session.flatId;
    }

    const visitor = await prisma.visitor.findFirst({ where });
    if (!visitor) return Response.json({ error: "Visitor not found" }, { status: 404 });

    const updated = await prisma.visitor.update({
      where: { id: visitorId },
      data: {
        residentResponse: action,
        respondedAt: new Date(),
        status: action === "approved" ? "expected" : "rejected",
        approvedBy: action === "approved" ? session.name : null,
      },
    });

    return Response.json({ visitor: updated, message: `Visitor ${action}` });
  } catch (error) {
    console.error("Visitor approval error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/visitors", nestPath: "/api/v1/operations/visitors", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/visitors", nestPath: "/api/v1/operations/visitors", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/visitors", nestPath: "/api/v1/operations/visitors", method: "PATCH" }, legacyPATCH);
