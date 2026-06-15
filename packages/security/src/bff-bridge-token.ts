import { SignJWT, jwtVerify } from "jose";
import type { AuthenticatedPrincipal, SocietyRole } from "./types.ts";

export const BFF_BRIDGE_ISSUER = "society-connect-bff";

export interface BffBridgeSessionClaims {
  subject: string;
  societyId: string;
  role: string;
  mfaVerified?: boolean;
  platformRoles?: readonly string[];
}

const LEGACY_ROLE_TO_SOCIETY_ROLES: Record<string, readonly SocietyRole[]> = {
  chairman: ["society_admin"],
  secretary: ["committee"],
  treasurer: ["treasurer"],
  member: ["resident"],
  tenant: ["resident"],
  watchman: ["guard"],
  guard: ["guard"],
  vendor_staff: ["resident"],
  facility_manager: ["committee"],
};

export function mapLegacyRoleToSocietyRoles(role: string): readonly SocietyRole[] {
  return LEGACY_ROLE_TO_SOCIETY_ROLES[role] ?? [];
}

export function sessionClaimsToPrincipal(claims: BffBridgeSessionClaims): AuthenticatedPrincipal {
  const societyRoles = mapLegacyRoleToSocietyRoles(claims.role);

  return {
    subject: claims.subject,
    memberships:
      societyRoles.length > 0
        ? [
            {
              societyId: claims.societyId,
              roles: societyRoles,
              mfaVerified: claims.mfaVerified ?? false,
            },
          ]
        : [],
    platformRoles: claims.platformRoles?.includes("platform_admin") ? ["platform_admin"] : [],
  };
}

export function getBffBridgeSecret(): string {
  return (
    process.env.API_BFF_BRIDGE_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    "dev-secret-local-only"
  );
}

export async function mintBffBridgeToken(
  claims: BffBridgeSessionClaims,
  secret = getBffBridgeSecret(),
): Promise<string> {
  const societyRoles = mapLegacyRoleToSocietyRoles(claims.role);

  return new SignJWT({
    society_memberships:
      societyRoles.length > 0
        ? [
            {
              societyId: claims.societyId,
              roles: societyRoles,
              mfaVerified: claims.mfaVerified ?? false,
            },
          ]
        : [],
    platform_roles: claims.platformRoles?.includes("platform_admin") ? ["platform_admin"] : [],
    legacy_role: claims.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(BFF_BRIDGE_ISSUER)
    .setSubject(claims.subject)
    .setAudience(process.env.KEYCLOAK_CLIENT_ID || "society-connect-api")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}

export async function verifyBffBridgeToken(
  token: string,
  secret = getBffBridgeSecret(),
): Promise<AuthenticatedPrincipal> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: BFF_BRIDGE_ISSUER,
    algorithms: ["HS256"],
  });

  if (typeof payload.sub !== "string" || payload.sub.trim() === "") {
    throw new Error("BFF bridge subject is required");
  }

  const societyId =
    Array.isArray(payload.society_memberships) &&
    payload.society_memberships[0] &&
    typeof payload.society_memberships[0] === "object" &&
    payload.society_memberships[0] !== null &&
    "societyId" in payload.society_memberships[0] &&
    typeof (payload.society_memberships[0] as { societyId?: unknown }).societyId === "string"
      ? (payload.society_memberships[0] as { societyId: string }).societyId
      : "";

  const legacyRole = typeof payload.legacy_role === "string" ? payload.legacy_role : "";

  return sessionClaimsToPrincipal({
    subject: payload.sub,
    societyId,
    role: legacyRole,
    mfaVerified:
      Array.isArray(payload.society_memberships) &&
      payload.society_memberships[0] &&
      typeof payload.society_memberships[0] === "object" &&
      payload.society_memberships[0] !== null &&
      "mfaVerified" in payload.society_memberships[0] &&
      (payload.society_memberships[0] as { mfaVerified?: unknown }).mfaVerified === true,
    platformRoles: Array.isArray(payload.platform_roles)
      ? payload.platform_roles.map(String)
      : [],
  });
}

export function isBffBridgeEnabled(): boolean {
  return process.env.API_BFF_BRIDGE_ENABLED === "true";
}
