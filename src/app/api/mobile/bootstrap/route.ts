import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_SCOPED_NOTIFICATION_TYPES } from "@/domain/notification-recipients";

export async function GET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isResident = ["member", "tenant"].includes(session.role);
  const isAdmin = ["chairman", "secretary", "treasurer"].includes(session.role);
  const residentFlatNumber = isResident ? await userFlatNumberFilter(session.flatId) : null;

  const [user, notifications, notices, complaints, bills, visitors, packages, staff, forumThreads, events, parkingSlots] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        flat: { select: { id: true, flatNumber: true, wing: true } },
        society: { select: { id: true, name: true, city: true, joinCode: true } },
      },
    }),
    prisma.notification.findMany({
      where: {
        societyId: session.societyId,
        OR: [
          { userId: session.userId },
          { userId: null, type: { notIn: USER_SCOPED_NOTIFICATION_TYPES } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.notice.findMany({
      where: { societyId: session.societyId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, category: true, createdAt: true },
    }),
    prisma.complaint.findMany({
      where: {
        societyId: session.societyId,
        ...(residentFlatNumber ? { flatNumber: residentFlatNumber } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, status: true, priority: true, createdAt: true },
    }),
    session.flatId
      ? prisma.maintenanceBill.findMany({
          where: isAdmin ? { societyId: session.societyId } : { societyId: session.societyId, flatId: session.flatId },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, period: true, amount: true, totalAmount: true, paidAmount: true, status: true, dueDate: true },
        })
      : Promise.resolve([]),
    prisma.visitor.findMany({
      where: {
        societyId: session.societyId,
        ...(isResident && session.flatId ? { flatId: session.flatId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, visitorName: true, purpose: true, status: true, expectedAt: true, entryTime: true, exitTime: true },
    }),
    session.flatId
      ? prisma.package.findMany({
          where: isAdmin ? { societyId: session.societyId } : { societyId: session.societyId, flatId: session.flatId },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, courierName: true, status: true, receivedAt: true, collectedAt: true },
        })
      : Promise.resolve([]),
    session.flatId
      ? prisma.domesticStaff.findMany({
          where: {
            societyId: session.societyId,
            isActive: true,
            flatLinks: {
              some: { flatId: session.flatId, isActive: true },
            },
          },
          select: {
            id: true,
            name: true,
            category: true,
            phone: true,
            flatLinks: {
              where: { flatId: session.flatId, isActive: true },
              select: { agreedMonthlyPay: true, schedule: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.forumThread.findMany({
      where: { societyId: session.societyId },
      include: {
        author: { select: { name: true, role: true } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }],
      take: 4,
    }),
    prisma.societyEvent.findMany({
      where: { societyId: session.societyId, startDate: { gte: new Date() } },
      select: { id: true, title: true, venue: true, startDate: true, category: true },
      orderBy: { startDate: "asc" },
      take: 4,
    }),
    session.flatId
      ? prisma.parkingSlot.findMany({
          where: { societyId: session.societyId, flatId: session.flatId, isAssigned: true },
          select: { id: true, slotNumber: true, slotType: true, level: true, wing: true, vehicleNo: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : Promise.resolve([]),
  ]);

  return Response.json({
    user,
    notifications,
    notices,
    complaints,
    bills,
    visitors,
    packages,
    staff,
    forumThreads,
    events,
    parkingSlots,
    generatedAt: new Date().toISOString(),
  });
}

async function userFlatNumberFilter(flatId?: string | null) {
  if (!flatId) return null;
  const flat = await prisma.flat.findUnique({ where: { id: flatId }, select: { flatNumber: true } });
  return flat?.flatNumber || null;
}
