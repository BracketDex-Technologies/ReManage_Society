import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ societyId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { session, response } = await requirePortalSession();
  if (response) return response;

  const { societyId } = await params;
  const body = await request.json().catch(() => ({}));
  const disabled = Boolean(body.disabled);

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      accessDisabledAt: true,
      users: { select: { id: true } },
    },
  });

  if (!society) {
    return Response.json({ error: "Society not found" }, { status: 404 });
  }

  if (society.deletedAt) {
    return Response.json({ error: "Deleted societies cannot be enabled or disabled" }, { status: 400 });
  }

  const userIds = society.users.map((user) => user.id);

  await prisma.$transaction(async (tx) => {
    await tx.society.update({
      where: { id: society.id },
      data: disabled
        ? {
            accessDisabledAt: new Date(),
            accessDisabledByPortalAdminId: session!.adminId,
            accessDisableReason: String(body.reason || "Subscription access disabled from portal").trim(),
          }
        : {
            accessDisabledAt: null,
            accessDisabledByPortalAdminId: null,
            accessDisableReason: null,
          },
    });

    if (disabled && userIds.length > 0) {
      await tx.userSession.deleteMany({
        where: { userId: { in: userIds } },
      });
    }
  });

  return Response.json({
    ok: true,
    society: {
      id: society.id,
      name: society.name,
      accessDisabledAt: disabled ? new Date().toISOString() : null,
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { session, response } = await requirePortalSession();
  if (response) return response;

  const { societyId } = await params;
  const body = await request.json().catch(() => ({}));
  const confirmationName = String(body.confirmationName || "").trim();

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      users: { select: { id: true } },
    },
  });

  if (!society) {
    return Response.json({ error: "Society not found" }, { status: 404 });
  }

  if (society.deletedAt) {
    return Response.json({ error: "Society is already deleted" }, { status: 400 });
  }

  if (confirmationName !== society.name) {
    return Response.json({ error: "Type the exact society name to confirm deletion" }, { status: 400 });
  }

  const userIds = society.users.map((user) => user.id);

  await prisma.$transaction(async (tx) => {
    await tx.society.update({
      where: { id: society.id },
      data: {
        deletedAt: new Date(),
        deletedByPortalAdminId: session!.adminId,
        deletionReason: String(body.reason || "Deleted from registered society portal").trim(),
      },
    });

    await tx.user.updateMany({
      where: { societyId: society.id },
      data: { isActive: false },
    });

    await tx.guardUser.updateMany({
      where: { societyId: society.id },
      data: { isActive: false },
    });

    if (userIds.length > 0) {
      await tx.userSession.deleteMany({
        where: { userId: { in: userIds } },
      });
    }
  });

  return Response.json({
    ok: true,
    society: {
      id: society.id,
      name: society.name,
    },
  });
}
