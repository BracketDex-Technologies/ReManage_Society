import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    await prisma.userSession.update({
      where: { token },
      data: { lastSeen: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Session may not exist or was already deleted — that's fine
    return NextResponse.json({ ok: true });
  }
}
