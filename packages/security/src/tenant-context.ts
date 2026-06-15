import type { AuthenticatedPrincipal, TenantContext } from "./types.ts";

export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAccessError";
  }
}

export function resolveTenantContext(
  principal: AuthenticatedPrincipal,
  requestedSocietyId: string,
): TenantContext {
  const membership = principal.memberships.find(
    (candidate) => candidate.societyId === requestedSocietyId,
  );

  if (membership) {
    return {
      actorId: principal.subject,
      societyId: membership.societyId,
      roles: membership.roles,
      mfaVerified: membership.mfaVerified,
      source: "membership",
    };
  }

  if (principal.platformRoles.includes("platform_admin")) {
    return {
      actorId: principal.subject,
      societyId: requestedSocietyId,
      roles: ["platform_admin"],
      mfaVerified: false,
      source: "platform-admin-override",
    };
  }

  throw new TenantAccessError(
    `Principal ${principal.subject} is not a member of society ${requestedSocietyId}`,
  );
}

