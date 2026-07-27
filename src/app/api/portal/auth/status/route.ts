import { getPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [adminCount, session] = await Promise.all([
    prisma.portalAdmin.count(),
    getPortalSession(),
  ]);

  return Response.json({
    hasPortalAdmins: adminCount > 0,
    admin: session
      ? {
          id: session.adminId,
          name: session.name,
          email: session.email,
          role: session.role,
        }
      : null,
  });
}
