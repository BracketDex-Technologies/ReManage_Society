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
  member: [
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
  tenant: [
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
