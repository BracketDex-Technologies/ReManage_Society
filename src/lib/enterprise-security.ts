import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function logSecurityEvent(params: {
  societyId?: string | null;
  userId?: string | null;
  eventType: string;
  severity?: "info" | "warning" | "critical";
  path?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const h = await headers();
    await prisma.securityEvent.create({
      data: {
        societyId: params.societyId || null,
        userId: params.userId || null,
        eventType: params.eventType,
        severity: params.severity || "info",
        path: params.path,
        ipAddress: h.get("x-forwarded-for")?.split(",")[0] || "unknown",
        userAgent: h.get("user-agent") || "unknown",
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

export function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self)",
  };
}
