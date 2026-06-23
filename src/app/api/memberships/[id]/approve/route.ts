import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary"].includes(session.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const membership = await prisma.societyMembership.findFirst({
    where: {
      id,
      societyId: session.societyId,
      status: "pending",
    },
  });

  if (!membership) {
    return Response.json({ error: "Pending membership not found" }, { status: 404 });
  }

  if (!membership.personId || !membership.flatId) {
    return Response.json({ error: "Membership is missing flat claim details" }, { status: 400 });
  }

  const personId = membership.personId;
  const flatId = membership.flatId;

  const activated = await prisma.$transaction(async (tx) => {
    const occupancy = await tx.unitOccupancy.findFirst({
      where: {
        societyId: session.societyId,
        personId,
        occupancyStatus: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });

    if (!occupancy) {
      throw new Error("Pending occupancy claim not found");
    }

    await tx.unitOccupancy.update({
      where: { id: occupancy.id },
      data: { occupancyStatus: "ACTIVE" },
    });

    await tx.user.update({
      where: { id: membership.userId },
      data: {
        role: membership.productRole,
        societyId: membership.societyId,
        flatId,
        personId,
        isActive: true,
      },
    });

    return tx.societyMembership.update({
      where: { id: membership.id },
      data: {
        status: "active",
        activatedAt: new Date(),
        approvedByUserId: session.userId,
      },
    });
  });

  return Response.json({ membership: activated });
}
