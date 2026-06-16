import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import SessionsPageClient from "./SessionsPageClient";

export const dynamic = "force-dynamic";

async function revokeSession(formData: FormData) {
  "use server";
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return;

  try {
    await prisma.userSession.delete({
      where: { token },
    });

    const cookieStore = await cookies();
    if (cookieStore.get("session")?.value === token) {
      cookieStore.delete("session");
    }

    revalidatePath("/system/sessions");
  } catch (error) {
    console.error("Failed to revoke session:", error);
  }
}

export default async function SessionsPage() {
  const session = await getSession();
  const cookieStore = await cookies();
  const currentToken = cookieStore.get("session")?.value;

  if (!session) {
    redirect("/login");
  }

  const isMember = session.role === "member";
  const sessions = await prisma.userSession.findMany({
    where: isMember ? { userId: session.userId } : {},
    include: { user: true },
    orderBy: { lastSeen: "desc" },
  });

  return (
    <SessionsPageClient
      sessions={sessions.map((sess) => ({
        id: sess.id,
        token: sess.token,
        os: sess.os,
        browser: sess.browser,
        ipAddress: sess.ipAddress,
        city: sess.city,
        country: sess.country,
        createdAt: sess.createdAt.toISOString(),
        user: { name: sess.user.name, role: sess.user.role },
      }))}
      currentToken={currentToken}
      isMember={isMember}
      revokeSession={revokeSession}
    />
  );
}
