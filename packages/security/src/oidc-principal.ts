import type {
  AuthenticatedPrincipal,
  PlatformRole,
  SocietyMembership,
  SocietyRole,
} from "./types.ts";

const SOCIETY_ROLES = new Set<SocietyRole>([
  "committee",
  "treasurer",
  "resident",
  "guard",
  "society_admin",
]);

const PLATFORM_ROLES = new Set<PlatformRole>(["platform_admin"]);

export type OidcClaims = Record<string, unknown> & {
  sub?: unknown;
  acr?: unknown;
  amr?: unknown;
  society_memberships?: unknown;
  platform_roles?: unknown;
};

export function mapOidcClaimsToPrincipal(claims: OidcClaims): AuthenticatedPrincipal {
  if (typeof claims.sub !== "string" || claims.sub.trim() === "") {
    throw new Error("OIDC subject is required");
  }

  return {
    subject: claims.sub,
    memberships: parseMemberships(claims.society_memberships, hasMfaClaim(claims)),
    platformRoles: parsePlatformRoles(claims.platform_roles),
  };
}

function parseMemberships(value: unknown, tokenMfaVerified: boolean): readonly SocietyMembership[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("society_memberships must be an array");
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error("society membership must be an object");
    }

    if (typeof item.societyId !== "string" || item.societyId.trim() === "") {
      throw new Error("society membership societyId is required");
    }

    if (!Array.isArray(item.roles)) {
      throw new Error("society membership roles must be an array");
    }

    const roles = item.roles.map((role) => {
      if (!SOCIETY_ROLES.has(role as SocietyRole)) {
        throw new Error(`Invalid society role: ${String(role)}`);
      }

      return role as SocietyRole;
    });

    return {
      societyId: item.societyId,
      roles,
      mfaVerified: item.mfaVerified === true || tokenMfaVerified,
    };
  });
}

function hasMfaClaim(claims: OidcClaims): boolean {
  if (claims.acr === "urn:mace:incommon:iap:silver" || claims.acr === "mfa") {
    return true;
  }

  if (!Array.isArray(claims.amr)) {
    return false;
  }

  return claims.amr.some((method) => method === "otp" || method === "mfa" || method === "webauthn");
}

function parsePlatformRoles(value: unknown): readonly PlatformRole[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("platform_roles must be an array");
  }

  return value.map((role) => {
    if (!PLATFORM_ROLES.has(role as PlatformRole)) {
      throw new Error(`Invalid platform role: ${String(role)}`);
    }

    return role as PlatformRole;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
