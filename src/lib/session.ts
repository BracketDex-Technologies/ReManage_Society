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
  societyId: string;
  role: string;
  name: string;
  email: string;
  flatId?: string;
  mfaPending?: boolean;
  mfaVerified?: boolean;
  mfaVerifiedAt?: Date;
  accessToken?: string;
  expiresAt: Date;
}

export interface SessionIdentity {
  userId: string;
  societyId: string;
  role: string;
  name: string;
  email: string;
  flatId?: string;
  accessToken?: string;
}

const MFA_PENDING_SESSION_DURATION_MS = 5 * 60 * 1000;
const STANDARD_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function createMfaPendingPayload(identity: SessionIdentity, now = new Date()): SessionPayload {
  return {
    ...identity,
    mfaPending: true,
    mfaVerified: false,
    expiresAt: new Date(now.getTime() + MFA_PENDING_SESSION_DURATION_MS),
  };
}

export function createVerifiedMfaPayload(identity: SessionIdentity, now = new Date()): SessionPayload {
  return {
    ...identity,
    mfaPending: false,
    mfaVerified: true,
    mfaVerifiedAt: now,
    expiresAt: new Date(now.getTime() + STANDARD_SESSION_DURATION_MS),
  };
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
