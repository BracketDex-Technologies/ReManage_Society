import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_SCOPED_NOTIFICATION_TYPES } from "@/domain/notification-recipients";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const notifications = await prisma.notification.findMany({
    where: {
      societyId: session!.societyId,
      OR: [
        { userId: session.userId },
        { userId: null, type: { notIn: USER_SCOPED_NOTIFICATION_TYPES } }, // broadcasts
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: {
      societyId: session!.societyId,
      isRead: false,
      OR: [
        { userId: session.userId },
        { userId: null, type: { notIn: USER_SCOPED_NOTIFICATION_TYPES } },
      ],
    },
  });

  return Response.json({ notifications, unreadCount });
}

// Mark notifications as read
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids, markAll } = await request.json();

  if (markAll) {
    await prisma.notification.updateMany({
      where: {
        societyId: session!.societyId,
        isRead: false,
        OR: [
          { userId: session.userId },
          { userId: null, type: { notIn: USER_SCOPED_NOTIFICATION_TYPES } },
        ],
      },
      data: { isRead: true },
    });
  } else if (ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, societyId: session!.societyId },
      data: { isRead: true },
    });
  }

  return Response.json({ ok: true });
}
