import { createSession, getSession } from "@/lib/auth";
import { mfaRateLimit } from "@/lib/rate-limit";
import { decryptTotpSecret, verifyTotpToken } from "@/lib/mfa/totp";
import { prisma } from "@/lib/prisma";

function sessionUser(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return {
    id: session.userId,
    societyId: session.societyId || null,
    role: session.role,
    name: session.name,
    email: session.email,
    flatId: session.flatId,
    accessToken: session.accessToken,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (session?.mfaPending !== true) {
    return Response.json({ error: "MFA verification requires a pending sign-in challenge." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await mfaRateLimit(session.userId, ip))) {
    return Response.json({ error: "Too many verification attempts. Please wait before trying again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { mfaTotpSecretEncrypted: true, mfaEnrolledAt: true },
  });

  if (!user?.mfaTotpSecretEncrypted || !user.mfaEnrolledAt || !verifyTotpToken(decryptTotpSecret(user.mfaTotpSecretEncrypted), code)) {
    return Response.json({ error: "Invalid verification code." }, { status: 400 });
  }

  const sessionToken = await createSession(sessionUser(session), { persistCookie: false, mfaVerified: true });
  return Response.json({ sessionToken });
}
