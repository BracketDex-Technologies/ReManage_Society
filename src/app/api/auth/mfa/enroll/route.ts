import { createSession, getSession } from "@/lib/auth";
import { mfaRateLimit } from "@/lib/rate-limit";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpToken,
} from "@/lib/mfa/totp";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

function getChallengeToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() || null : null;
}

async function requirePendingSession() {
  const session = await getSession();
  return session?.mfaPending === true ? session : null;
}

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
  const session = await requirePendingSession();
  if (!session) return Response.json({ error: "MFA enrollment requires a pending sign-in challenge." }, { status: 401 });

  const secret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(secret);
  await prisma.user.update({
    where: { id: session.userId },
    data: { mfaTotpSecretEncrypted: encryptedSecret, mfaEnrolledAt: null },
  });

  const uri = `otpauth://totp/${encodeURIComponent(`ReManage:${session.email}`)}?secret=${secret}&issuer=ReManage&algorithm=SHA1&digits=6&period=30`;
  const qrCode = await QRCode.toDataURL(uri, { width: 256, margin: 2 });

  return Response.json({ uri, qrCode });
}

export async function PATCH(request: Request) {
  const session = await requirePendingSession();
  if (!session) return Response.json({ error: "MFA enrollment requires a pending sign-in challenge." }, { status: 401 });

  const token = getChallengeToken(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await mfaRateLimit(session.userId, ip))) {
    return Response.json({ error: "Too many verification attempts. Please wait before trying again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { mfaTotpSecretEncrypted: true },
  });

  if (!user?.mfaTotpSecretEncrypted || !verifyTotpToken(decryptTotpSecret(user.mfaTotpSecretEncrypted), code)) {
    return Response.json({ error: "Invalid verification code." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.userId }, data: { mfaEnrolledAt: new Date() } });
  const sessionToken = await createSession(sessionUser(session), { persistCookie: false, mfaVerified: true });
  return Response.json({ sessionToken });
}
