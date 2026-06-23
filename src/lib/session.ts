import { SignJWT, jwtVerify } from "jose";

// SECURITY: Never use fallback in production — checked lazily to avoid build-time crash
let _encodedKey: Uint8Array | null = null;
function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
}

function getEncodedKey(): Uint8Array {
  if (_encodedKey) return _encodedKey;
  const secretKey = getSessionSecret();
  if (!secretKey && process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: SESSION_SECRET or AUTH_SECRET or NEXTAUTH_SECRET must be set in production!");
  }
  if (secretKey && secretKey.length < 32 && process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: session secret must be at least 32 characters in production!");
  }
  _encodedKey = new TextEncoder().encode(secretKey || "dev-secret-local-only");
  return _encodedKey;
}

export interface SessionPayload {
  userId: string;
  membershipId?: string;
  societyId: string;
  role: string;
  permissionRole?: string;
  name: string;
  email: string;
  flatId?: string;
  mfaVerified?: boolean;
  accessToken?: string;
  expiresAt: Date;
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getEncodedKey());
}

export async function decryptSession(
  session: string | undefined = ""
): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
