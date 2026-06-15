import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

// Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { endpoint, keys } = await request.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: "Invalid subscription data" }, { status: 400 });
    }

    // Upsert - update if same endpoint exists
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.userId },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: session.userId,
        societyId: session!.societyId,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return Response.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}

// Unsubscribe
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { endpoint } = await request.json();
    if (!endpoint) return Response.json({ error: "Endpoint required" }, { status: 400 });

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.userId },
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
