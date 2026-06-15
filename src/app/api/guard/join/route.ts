import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/join-code";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { joinCode, name, phone, pin, gateAssignment } = await request.json();
    const code = normalizeJoinCode(joinCode || "");
    const cleanPhone = String(phone || "").replace(/\D/g, "");

    if (!code || !name || !cleanPhone || !pin) {
      return Response.json(
        { error: "Join code, name, phone, and PIN are required" },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      return Response.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
    }

    if (!/^\d{4}$/.test(String(pin))) {
      return Response.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
    }

    const society = await prisma.society.findUnique({
      where: { joinCode: code },
      select: { id: true, name: true },
    });

    if (!society) {
      return Response.json({ error: "Invalid society join code" }, { status: 404 });
    }

    const existing = await prisma.guardUser.findFirst({
      where: { societyId: society.id, phone: cleanPhone },
    });

    if (existing) {
      return Response.json({
        message: existing.isActive
          ? "Guard already active. Please login."
          : "Request already submitted. Committee approval is pending.",
        pending: !existing.isActive,
      });
    }

    const hashedPin = await bcrypt.hash(String(pin), 10);
    const guard = await prisma.guardUser.create({
      data: {
        societyId: society.id,
        name: String(name).trim(),
        phone: cleanPhone,
        pin: hashedPin,
        gateAssignment: gateAssignment || null,
        isActive: false,
      },
    });

    await prisma.notification.create({
      data: {
        societyId: society.id,
        type: "guard_access_request",
        title: "Guard Access Request",
        message: `${guard.name} requested gate access for ${society.name}.`,
        link: "/settings",
      },
    });

    return Response.json({
      guard: { id: guard.id, name: guard.name, phone: guard.phone },
      pending: true,
      message: "Request submitted. Committee approval is required before login.",
    }, { status: 201 });
  } catch (error) {
    console.error("Guard join error:", error);
    return Response.json({ error: "Could not submit guard request" }, { status: 500 });
  }
}
