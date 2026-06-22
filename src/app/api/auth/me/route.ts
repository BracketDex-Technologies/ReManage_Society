import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/api-cache";
import { getResidentFlatForSession } from "@/lib/resident-flat";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cache user lookup for 30s — this endpoint is called by layout on every navigation
  // but the user data almost never changes within a session
  const cacheKey = `auth-me:${session.userId}`;

  const user = await cached(cacheKey, async () => {
    return prisma.user.findUnique({
      where: { id: session.userId },
      include: { society: true, flat: { select: { flatNumber: true, wing: true } } },
    });
  }, 30_000);

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const resolvedFlat = user.flat
    ? { flatNumber: user.flat.flatNumber, wing: user.flat.wing }
    : await getResidentFlatForSession(session);

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      societyId: user.societyId,
      flatId: user.flatId || (resolvedFlat && "id" in resolvedFlat ? resolvedFlat.id : null),
      flatNumber: user.flat?.flatNumber || (resolvedFlat && "flatNumber" in resolvedFlat ? resolvedFlat.flatNumber : null),
      society: user.society,
      joinCode: user.society?.joinCode,
      noFlatLinked: !(user.flatId || resolvedFlat),
      mfaVerified: session.mfaVerified === true,
    },
  });
}
