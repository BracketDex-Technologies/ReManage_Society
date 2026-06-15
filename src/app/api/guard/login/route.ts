import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

// Guard login via phone + PIN (no session cookie - returns token-like guard data)
export async function POST(request: NextRequest) {
  try {
    const { phone, pin, societyId } = await request.json();

    if (!phone || !pin) {
      return Response.json({ error: "Phone and PIN required" }, { status: 400 });
    }

    // Find guard by phone
    const guards = await prisma.guardUser.findMany({
      where: { phone, ...(societyId ? { societyId } : {}) },
      include: { society: { select: { name: true, id: true, address: true } } },
    });

    if (guards.length === 0) {
      return Response.json({ error: "Guard not found" }, { status: 404 });
    }

    // Try each guard (in case same phone in multiple societies)
    for (const guard of guards) {
      const valid = await bcrypt.compare(pin, guard.pin);
      if (valid) {
        if (!guard.isActive) {
          return Response.json(
            { error: "Guard access is pending committee approval" },
            { status: 403 }
          );
        }

        return Response.json({
          guard: {
            id: guard.id,
            name: guard.name,
            phone: guard.phone,
            gateAssignment: guard.gateAssignment,
            shiftStart: guard.shiftStart,
            shiftEnd: guard.shiftEnd,
            societyId: guard.societyId,
            societyName: guard.society.name,
            societyAddress: guard.society.address,
          },
        });
      }
    }

    return Response.json({ error: "Invalid PIN" }, { status: 401 });
  } catch {
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}
