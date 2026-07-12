import { generateTemporaryPassword } from "@/lib/portal-admin";
import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

interface RouteContext {
  params: Promise<{ societyId: string }>;
}

async function findChairmanUser(societyId: string) {
  const directChairman = await prisma.user.findFirst({
    where: {
      societyId,
      role: "chairman",
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (directChairman) return directChairman;

  const membership = await prisma.societyMembership.findFirst({
    where: {
      societyId,
      productRole: "chairman",
      status: "active",
      user: { isActive: true },
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return membership?.user || null;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { response } = await requirePortalSession();
  if (response) return response;

  const { societyId } = await params;
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { id: true, name: true },
  });
  if (!society) {
    return Response.json({ error: "Society not found" }, { status: 404 });
  }

  const chairman = await findChairmanUser(society.id);
  if (!chairman) {
    return Response.json({ error: "Chairman account not found for this society" }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: chairman.id },
    data: { password: await bcrypt.hash(temporaryPassword, 12) },
  });

  return Response.json({
    society: {
      id: society.id,
      name: society.name,
    },
    chairman: {
      id: chairman.id,
      name: chairman.name,
      email: chairman.email,
    },
    temporaryPassword,
  });
}
