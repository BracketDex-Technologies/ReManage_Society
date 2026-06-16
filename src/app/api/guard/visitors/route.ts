import { prisma } from "@/lib/prisma";
import { sendPushToFlat } from "@/lib/push";
import { NextRequest } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

// Guard creates a visitor entry and sends approval request to flat member
const LEGACY_ROUTE = "/api/guard/visitors";
const NEST_GET = "/api/v1/operations/guard/visitors/list";

async function legacyPOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guardId, societyId, visitorName, phone, flatNumber, purpose, vehicleNo, passcode } = body;

    if (!societyId || !visitorName || !flatNumber) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify guard
    if (guardId) {
      const guard = await prisma.guardUser.findFirst({
        where: { id: guardId, societyId },
      });
      if (!guard) return Response.json({ error: "Invalid guard" }, { status: 403 });
    }

    // Check if pre-approved via passcode
    if (passcode) {
      const preApproved = await prisma.visitor.findFirst({
        where: {
          societyId,
          flatNumber,
          passcode,
          status: "expected",
          isPreApproved: true,
        },
      });

      if (preApproved) {
        const updated = await prisma.visitor.update({
          where: { id: preApproved.id },
          data: {
            status: "in",
            entryTime: new Date(),
            guardId: guardId || null,
            verificationMethod: "passcode",
          },
        });
        return Response.json({ visitor: updated, preApproved: true, message: "Pre-approved visitor checked in!" });
      }
      return Response.json({ error: "Invalid passcode" }, { status: 400 });
    }

    // Find flat
    const flat = await prisma.flat.findFirst({
      where: { societyId, flatNumber },
    });

    // Create visitor in "expected" state (waiting for approval)
    const visitor = await prisma.visitor.create({
      data: {
        societyId,
        flatId: flat?.id,
        flatNumber,
        visitorName: visitorName.trim(),
        phone: phone || null,
        purpose: purpose || "guest",
        vehicleNo: vehicleNo || null,
        status: "expected",
        isPreApproved: false,
        guardId: guardId || null,
        verificationMethod: "manual",
      },
    });

    // Send push notification to flat members
    await sendPushToFlat(
      societyId,
      flatNumber,
      "🚪 Visitor at Gate",
      `${visitorName} is here to see you (${purpose}). Approve or reject.`,
      `/my-visitors?approve=${visitor.id}`
    );

    // Also create an in-app notification
    if (flat) {
      const flatUsers = await prisma.user.findMany({
        where: { societyId, flatId: flat.id },
        select: { id: true },
      });
      for (const u of flatUsers) {
        await prisma.notification.create({
          data: {
            societyId,
            userId: u.id,
            type: "visitor_entry",
            title: "Visitor at Gate",
            message: `${visitorName} is waiting at the gate. Purpose: ${purpose}`,
            link: `/my-visitors?approve=${visitor.id}`,
          },
        });
      }
    }

    return Response.json({
      visitor,
      message: "Approval request sent to flat member",
      awaitingApproval: true,
    });
  } catch (error) {
    console.error("Guard visitor error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

// GET - guard checks approval status of a visitor
async function legacyGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const visitorId = searchParams.get("visitorId");
    const societyId = searchParams.get("societyId");

    if (!visitorId || !societyId) {
      return Response.json({ error: "Missing params" }, { status: 400 });
    }

    const visitor = await prisma.visitor.findFirst({
      where: { id: visitorId, societyId },
      select: {
        id: true,
        visitorName: true,
        flatNumber: true,
        status: true,
        residentResponse: true,
        respondedAt: true,
        approvedBy: true,
        isPreApproved: true,
      },
    });

    if (!visitor) return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json(visitor);
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export const POST = shimOrFallback(
  { legacyRoute: "/api/guard", nestPath: "/api/v1/operations", method: "POST", requireAuth: false },
  legacyPOST,
);
export const GET = shimOrFallback(
  { legacyRoute: "/api/guard", nestPath: "/api/v1/operations", method: "GET", requireAuth: false },
  legacyGET,
);
