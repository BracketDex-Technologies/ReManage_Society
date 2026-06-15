import { resolveTenantContext, TenantAccessError } from "./tenant-context.ts";
import type { AuthenticatedPrincipal, PermissionAction, SocietyRole } from "./types.ts";

export interface PermissionRequest {
  principal: AuthenticatedPrincipal;
  action: PermissionAction;
  societyId: string;
}

export type PermissionDecision =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string };

const ROLE_PERMISSIONS: Record<SocietyRole | "platform_admin", readonly PermissionAction[]> = {
  committee: [
    "audit:event.read",
    "society:core.manage",
    "society:directory.read",
    "society:finance.read",
    "society:occupancy.manage",
    "society:import.manage",
    "operations:gate.manage",
    "operations:visitor.respond",
    "operations:read",
    "operations:manage",
    "operations:booking.manage",
    "operations:sos.raise",
    "community:read",
    "community:notice.manage",
    "community:helpdesk.respond",
    "community:helpdesk.manage",
    "community:document.manage",
    "community:governance.manage",
    "community:vote.cast",
    "community:rsvp.manage",
    "community:post",
    "community:moderate",
    "tenant:membership.read",
  ],
  treasurer: [
    "audit:event.read",
    "society:directory.read",
    "society:finance.manage",
    "society:finance.read",
    "operations:read",
    "community:read",
    "tenant:membership.read",
  ],
  resident: [
    "society:directory.read",
    "society:finance.read",
    "operations:visitor.respond",
    "operations:read",
    "operations:booking.manage",
    "operations:sos.raise",
    "community:read",
    "community:helpdesk.respond",
    "community:vote.cast",
    "community:rsvp.manage",
    "community:post",
  ],
  guard: [
    "operations:gate.manage",
    "operations:read",
    "operations:sos.raise",
    "community:read",
  ],
  society_admin: [
    "audit:event.read",
    "society:core.manage",
    "society:directory.read",
    "society:finance.manage",
    "society:finance.read",
    "society:settings.manage",
    "society:occupancy.manage",
    "society:import.manage",
    "operations:gate.manage",
    "operations:visitor.respond",
    "operations:read",
    "operations:manage",
    "operations:booking.manage",
    "operations:sos.raise",
    "community:read",
    "community:notice.manage",
    "community:helpdesk.respond",
    "community:helpdesk.manage",
    "community:document.manage",
    "community:governance.manage",
    "community:vote.cast",
    "community:rsvp.manage",
    "community:post",
    "community:moderate",
    "tenant:membership.read",
  ],
  platform_admin: [
    "audit:event.read",
    "society:onboard",
    "society:core.manage",
    "society:directory.read",
    "society:finance.manage",
    "society:finance.read",
    "society:settings.manage",
    "society:occupancy.manage",
    "society:import.manage",
    "operations:gate.manage",
    "operations:visitor.respond",
    "operations:read",
    "operations:manage",
    "operations:booking.manage",
    "operations:sos.raise",
    "community:read",
    "community:notice.manage",
    "community:helpdesk.respond",
    "community:helpdesk.manage",
    "community:document.manage",
    "community:governance.manage",
    "community:vote.cast",
    "community:rsvp.manage",
    "community:post",
    "community:moderate",
    "tenant:membership.read",
  ],
};

const MFA_REQUIRED_ACTIONS = new Set<PermissionAction>([
  "audit:event.read",
  "society:onboard",
  "society:core.manage",
  "society:finance.manage",
  "society:occupancy.manage",
  "society:import.manage",
  "society:settings.manage",
  "operations:manage",
  "community:document.manage",
  "community:governance.manage",
]);

/** MFA is enforced in production unless explicitly overridden via MFA_ENFORCEMENT_ENABLED. */
export function isMfaEnforcementEnabled(): boolean {
  const override = process.env.MFA_ENFORCEMENT_ENABLED?.trim().toLowerCase();
  if (override === "true") {
    return true;
  }
  if (override === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

export function evaluatePermission(request: PermissionRequest): PermissionDecision {
  let tenantContext;

  try {
    tenantContext = resolveTenantContext(request.principal, request.societyId);
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return { allowed: false, reason: error.message };
    }

    throw error;
  }

  if (
    isMfaEnforcementEnabled() &&
    MFA_REQUIRED_ACTIONS.has(request.action) &&
    !tenantContext.mfaVerified
  ) {
    const wouldBeAllowed = tenantContext.roles.some((role) =>
      ROLE_PERMISSIONS[role].includes(request.action),
    );

    if (wouldBeAllowed) {
      return {
        allowed: false,
        reason: `MFA is required for ${request.action}`,
      };
    }
  }

  const allowedRole = tenantContext.roles.find((role) =>
    ROLE_PERMISSIONS[role].includes(request.action),
  );

  if (!allowedRole) {
    return {
      allowed: false,
      reason: `No active role can perform ${request.action}`,
    };
  }

  return {
    allowed: true,
    reason: `Allowed by role ${allowedRole}`,
  };
}
