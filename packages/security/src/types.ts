export type SocietyRole =
  | "committee"
  | "treasurer"
  | "resident"
  | "member"
  | "tenant"
  | "guard"
  | "society_admin";

export type PlatformRole = "platform_admin";

export type PermissionAction =
  | "audit:event.read"
  | "society:onboard"
  | "society:settings.manage"
  | "society:core.manage"
  | "society:directory.read"
  | "society:finance.manage"
  | "society:finance.read"
  | "society:occupancy.manage"
  | "society:import.manage"
  | "operations:gate.manage"
  | "operations:visitor.respond"
  | "operations:read"
  | "operations:manage"
  | "operations:booking.manage"
  | "operations:sos.raise"
  | "community:read"
  | "community:notice.manage"
  | "community:helpdesk.respond"
  | "community:helpdesk.manage"
  | "community:document.manage"
  | "community:governance.manage"
  | "community:vote.cast"
  | "community:rsvp.manage"
  | "community:post"
  | "community:moderate"
  | "tenant:membership.read";

export interface SocietyMembership {
  societyId: string;
  roles: readonly SocietyRole[];
  mfaVerified: boolean;
}

export interface AuthenticatedPrincipal {
  subject: string;
  memberships: readonly SocietyMembership[];
  platformRoles: readonly PlatformRole[];
}

export interface TenantContext {
  actorId: string;
  societyId: string;
  roles: readonly (SocietyRole | PlatformRole)[];
  mfaVerified: boolean;
  source: "membership" | "platform-admin-override";
}
