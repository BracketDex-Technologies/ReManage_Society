import type { NextRequest } from "next/server";
import { decryptSession, type SessionPayload } from "@/lib/session";

export function getBearerTokenFromRequest(request: NextRequest | Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return token || null;
  }
  return null;
}

export async function getSessionFromRequest(
  request: NextRequest | Request,
  cookieToken?: string | null,
): Promise<SessionPayload | null> {
  const bearer = getBearerTokenFromRequest(request);
  if (bearer) {
    return decryptSession(bearer);
  }
  if (cookieToken) {
    return decryptSession(cookieToken);
  }
  return null;
}
