import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary"].includes(session.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const memberships = await prisma.societyMembership.findMany({
    where: {
      societyId: session.societyId,
      status: "pending",
    },
    include: {
      flat: { select: { flatNumber: true, wing: true } },
      user: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const personIds = memberships.map((m) => m.personId).filter(Boolean) as string[];
  
  const occupancies = personIds.length > 0 ? await prisma.unitOccupancy.findMany({
    where: {
      societyId: session.societyId,
      personId: { in: personIds },
      occupancyStatus: "PENDING",
    },
  }) : [];

  const occupancyMap = new Map(occupancies.map((o) => [o.personId, o.relationshipType]));

  const pending = memberships.map((m) => ({
    id: m.id,
    createdAt: m.createdAt,
    productRole: m.productRole,
    relationshipType: m.personId ? occupancyMap.get(m.personId) || "OWNER" : "OWNER",
    flat: m.flat,
    user: m.user,
  }));

  return Response.json({
    pending,
    summary: { pending: pending.length },
  });
}
