import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/guard";
const NEST_GET = "/api/v1/operations/guard/list";
const NEST_POST = "/api/v1/operations/guard/register";

async function legacyGET() {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guards = await prisma.guardUser.findMany({
      where: { societyId: session!.societyId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ guards });
  } catch {
    return Response.json({ error: "Failed to fetch guards" }, { status: 500 });
  }
}

async function legacyPATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guardId, isActive, gateAssignment, shiftStart, shiftEnd } = await request.json();
    if (!guardId) {
      return Response.json({ error: "Guard ID is required" }, { status: 400 });
    }

    const existing = await prisma.guardUser.findFirst({
      where: { id: guardId, societyId: session.societyId },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Guard not found" }, { status: 404 });
    }

    const guard = await prisma.guardUser.update({
      where: { id: guardId },
      data: {
        ...(typeof isActive === "boolean" ? { isActive } : {}),
        ...(gateAssignment !== undefined ? { gateAssignment: gateAssignment || null } : {}),
        ...(shiftStart !== undefined ? { shiftStart: shiftStart || null } : {}),
        ...(shiftEnd !== undefined ? { shiftEnd: shiftEnd || null } : {}),
      },
    });

    return Response.json({ guard });
  } catch (error) {
    console.error("Guard update error:", error);
    return Response.json({ error: "Failed to update guard" }, { status: 500 });
  }
}

async function legacyPOST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary"].includes(session!.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, phone, pin, gateAssignment, shiftStart, shiftEnd } = await request.json();
    const cleanPhone = String(phone || "").replace(/\D/g, "");

    if (!name || !cleanPhone || !pin) {
      return Response.json({ error: "Name, phone and PIN are required" }, { status: 400 });
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      return Response.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
    }

    if (!/^\d{4}$/.test(String(pin))) {
      return Response.json({ error: "PIN must be 4 digits" }, { status: 400 });
    }

    const existingGuard = await prisma.guardUser.findFirst({
      where: { societyId: session.societyId, phone: cleanPhone },
    });

    if (existingGuard) {
      return Response.json({ error: "A guard with this phone already exists" }, { status: 400 });
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    // Also create a User account for the guard so they can login
    const guardEmail = `guard_${cleanPhone}@${session!.societyId}.society`;
    const guardPassword = await bcrypt.hash(pin + cleanPhone.slice(-4), 10);

    let guardUser;
    try {
      guardUser = await prisma.user.create({
        data: {
          name,
          email: guardEmail,
          password: guardPassword,
          phone: cleanPhone,
          role: "guard",
          societyId: session!.societyId,
        },
      });
    } catch {
      // User might already exist
    }

    const guard = await prisma.guardUser.create({
      data: {
        societyId: session!.societyId,
        name,
        phone: cleanPhone,
        pin: hashedPin,
        gateAssignment: gateAssignment || null,
        shiftStart: shiftStart || null,
        shiftEnd: shiftEnd || null,
      },
    });

    return Response.json({
      ...guard,
      loginCredentials: guardUser ? {
        email: guardEmail,
        password: `${pin}${cleanPhone.slice(-4)}`,
        note: "Guard can login with these credentials"
      } : null,
    });
  } catch {
    return Response.json({ error: "Failed to create guard" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/guard", nestPath: "/api/v1/operations", method: "GET" }, legacyGET);
export const PATCH = shimOrFallback({ legacyRoute: "/api/guard", nestPath: "/api/v1/operations", method: "PATCH" }, legacyPATCH);
export const POST = shimOrFallback({ legacyRoute: "/api/guard", nestPath: "/api/v1/operations", method: "POST" }, legacyPOST);
