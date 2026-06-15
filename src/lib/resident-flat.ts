import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";

const flatSelect = {
  id: true,
  flatNumber: true,
  wing: true,
} as const;

type ResidentFlat = {
  id: string;
  flatNumber: string;
  wing: string | null;
};

async function findFlatById(flatId: string, societyId: string): Promise<ResidentFlat | null> {
  return prisma.flat.findFirst({
    where: { id: flatId, societyId, isActive: true },
    select: flatSelect,
  });
}

async function syncUserFlatId(userId: string, flatId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { flatId },
    });
  } catch {
    // Non-fatal — next request can resolve again.
  }
}

export async function getResidentFlatForSession(
  session: SessionPayload,
  options: { syncUserFlat?: boolean } = { syncUserFlat: true },
): Promise<ResidentFlat | null> {
  const sessionFlatId = session.flatId?.trim();
  if (sessionFlatId) {
    const flat = await findFlatById(sessionFlatId, session.societyId);
    if (flat) return flat;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { flatId: true, personId: true, email: true },
  });

  if (!user) return null;

  if (user.flatId) {
    const flat = await findFlatById(user.flatId, session.societyId);
    if (flat) return flat;
  }

  if (user.personId) {
    const occupancy = await prisma.unitOccupancy.findFirst({
      where: {
        personId: user.personId,
        societyId: session.societyId,
        isActive: true,
        occupancyStatus: "ACTIVE",
      },
      include: {
        unit: { select: { legacyFlatId: true } },
      },
      orderBy: [{ isPrimaryOccupant: "desc" }, { createdAt: "desc" }],
    });

    if (occupancy?.unit.legacyFlatId) {
      const flat = await findFlatById(occupancy.unit.legacyFlatId, session.societyId);
      if (flat) {
        if (options.syncUserFlat) await syncUserFlatId(session.userId, flat.id);
        return flat;
      }
    }
  }

  const emailFlat = await prisma.flat.findFirst({
    where: {
      societyId: session.societyId,
      isActive: true,
      email: { equals: user.email, mode: "insensitive" },
    },
    select: flatSelect,
  });

  if (emailFlat) {
    if (options.syncUserFlat) await syncUserFlatId(session.userId, emailFlat.id);
    return emailFlat;
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      societyId: session.societyId,
      status: "active",
      OR: [
        { userId: session.userId },
        { email: { equals: user.email, mode: "insensitive" } },
      ],
    },
    select: { flatId: true },
  });

  if (tenant?.flatId) {
    const flat = await findFlatById(tenant.flatId, session.societyId);
    if (flat) {
      if (options.syncUserFlat) await syncUserFlatId(session.userId, flat.id);
      return flat;
    }
  }

  return null;
}

export function isResidentRole(role: string): boolean {
  return role === "member" || role === "tenant";
}

export function isStaffManagerRole(role: string): boolean {
  return ["chairman", "secretary", "treasurer", "facility_manager"].includes(role);
}

export function noFlatLinkedPayload(message = "No flat linked to this account") {
  return {
    noFlatLinked: true as const,
    message,
  };
}
