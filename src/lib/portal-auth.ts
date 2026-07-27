import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const PORTAL_COOKIE_NAME = "portal_session";

let encodedKey: Uint8Array | null = null;

export type PortalSessionPayload = {
  adminId: string;
  name: string;
  email: string;
  role: string;
  expiresAt: Date;
};

function getSessionSecret() {
  return process.env.PORTAL_SESSION_SECRET
    || process.env.SESSION_SECRET
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET;
}

function getEncodedKey() {
  if (encodedKey) return encodedKey;
  const secretKey = getSessionSecret();
  if (!secretKey && process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: PORTAL_SESSION_SECRET or SESSION_SECRET must be set in production!");
  }
  if (secretKey && secretKey.length < 32 && process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: portal session secret must be at least 32 characters in production!");
  }
  encodedKey = new TextEncoder().encode(secretKey || "dev-secret-local-only");
  return encodedKey;
}

export async function encryptPortalSession(payload: PortalSessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getEncodedKey());
}

export async function decryptPortalSession(session: string | undefined = "") {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as PortalSessionPayload;
  } catch {
    return null;
  }
}

export async function createPortalSession(admin: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await encryptPortalSession({
    adminId: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });

  return token;
}

export async function getPortalSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PORTAL_COOKIE_NAME)?.value;
  return decryptPortalSession(session);
}

export async function requirePortalSession() {
  const session = await getPortalSession();
  if (!session?.adminId) {
    return { session: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, response: null };
}

export async function deletePortalSession() {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_COOKIE_NAME);
}
