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

// POST: Trigger SOS alert to all committee + guards
const LEGACY_ROUTE = "/api/emergency/sos";
const NEST_POST = "/api/v1/operations/sos/trigger";

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, message } = await request.json();

    const alertTypes: Record<string, string> = {
      fire: "🔥 FIRE EMERGENCY",
      medical: "🚑 MEDICAL EMERGENCY",
      security: "🚨 SECURITY THREAT",
      natural: "⚠️ NATURAL DISASTER",
      other: "🆘 EMERGENCY ALERT",
    };

    const title = alertTypes[type] || alertTypes.other;
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { flat: { select: { flatNumber: true, wing: true } } },
    });

    const flatInfo = user?.flat
      ? `${user.flat.wing ? `${user.flat.wing}-` : ""}${user.flat.flatNumber}`
      : "Unknown";

    const alertMessage = `${title}\nFrom: ${session.name} (Flat ${flatInfo})\n${message || "Immediate assistance needed!"}`;

    // Create urgent notification
    await prisma.notification.create({
      data: {
        societyId: session!.societyId,
        type: "emergency",
        title,
        message: alertMessage,
        link: "/emergency",
      },
    });

    // Log as gate incident
    await prisma.gateIncident.create({
      data: {
        societyId: session!.societyId,
        type: type || "emergency",
        severity: "critical",
        description: alertMessage,
        reportedBy: session.userId,
        status: "open",
      },
    });

    // Get responders
    const responders = await prisma.user.findMany({
      where: {
        societyId: session!.societyId,
        role: { in: ["chairman", "secretary", "treasurer", "guard"] },
      },
      select: { name: true, phone: true, role: true },
    });

    return Response.json({
      success: true,
      message: "Emergency alert sent",
      responders,
    });
  } catch {
    return Response.json({ error: "Failed to send alert" }, { status: 500 });
  }
}

export const POST = shimOrFallback({ legacyRoute: "/api/emergency", nestPath: "/api/v1/operations/sos", method: "POST" }, legacyPOST);
