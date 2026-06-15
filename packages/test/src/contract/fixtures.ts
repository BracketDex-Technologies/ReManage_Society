import type { AuthenticatedPrincipal } from "@society/security";

export function committeePrincipal(
  societyId: string,
  options: { mfaVerified?: boolean; subject?: string } = {},
): AuthenticatedPrincipal {
  return {
    subject: options.subject ?? "committee_1",
    memberships: [
      {
        societyId,
        roles: ["committee"],
        mfaVerified: options.mfaVerified ?? true,
      },
    ],
    platformRoles: [],
  };
}

export function treasurerPrincipal(
  societyId: string,
  options: { mfaVerified?: boolean } = {},
): AuthenticatedPrincipal {
  return {
    subject: "treasurer_1",
    memberships: [
      {
        societyId,
        roles: ["treasurer"],
        mfaVerified: options.mfaVerified ?? true,
      },
    ],
    platformRoles: [],
  };
}

export function residentPrincipal(societyId: string): AuthenticatedPrincipal {
  return {
    subject: "resident_1",
    memberships: [
      {
        societyId,
        roles: ["resident"],
        mfaVerified: false,
      },
    ],
    platformRoles: [],
  };
}

export function guardPrincipal(
  societyId: string,
  options: { subject?: string } = {},
): AuthenticatedPrincipal {
  return {
    subject: options.subject ?? "guard_1",
    memberships: [
      {
        societyId,
        roles: ["guard"],
        mfaVerified: false,
      },
    ],
    platformRoles: [],
  };
}
