import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { getResidentFlatForSession } from "@/lib/resident-flat";

const ADMIN_ROLES = ["chairman", "secretary", "treasurer"] as const;
const COOLDOWN_MS = 60_000;
const recentRequests = new Map<string, number>();

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lastSent = recentRequests.get(session.userId);
  if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
    return Response.json(
      { error: "Please wait a minute before sending another request." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const category = String(body.category || "general");
  const customMessage = String(body.message || "").trim().slice(0, 500);

  const flat = await getResidentFlatForSession(session, { syncUserFlat: true });
  const flatLabel = flat
    ? `${flat.wing ? `${flat.wing}-` : ""}${flat.flatNumber}`
    : "Not assigned";

  const admins = await prisma.user.findMany({
    where: {
      societyId: session.societyId,
      role: { in: [...ADMIN_ROLES] },
    },
    select: { id: true, name: true },
  });

  if (admins.length === 0) {
    return Response.json({ error: "No society admin accounts found." }, { status: 404 });
  }

  const title =
    category === "flat_link"
      ? "Flat link request"
      : "Resident message";

  const message =
    customMessage ||
    (category === "flat_link"
      ? `${session.name} (${session.email}) requested flat assignment. Current flat: ${flatLabel}.`
      : `${session.name} sent a message to the committee.`);

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        societyId: session.societyId,
        userId: admin.id,
        type: "admin_request",
        title,
        message,
        link: category === "flat_link" ? "/members" : "/dashboard",
      }),
    ),
  );

  recentRequests.set(session.userId, Date.now());

  return Response.json({
    ok: true,
    notified: admins.length,
    message: `Committee notified (${admins.length} admin${admins.length === 1 ? "" : "s"}).`,
  });
}
