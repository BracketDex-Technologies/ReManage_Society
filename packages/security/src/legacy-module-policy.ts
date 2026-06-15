import type { PermissionAction } from "./types.ts";
import { evaluatePermission } from "./permission-policy.ts";
import { sessionClaimsToPrincipal } from "./bff-bridge-token.ts";

const MODULE_TO_ACTION: Record<string, PermissionAction> = {
  dashboard: "community:read",
  members: "society:core.manage",
  maintenance: "society:finance.read",
  bills: "society:finance.read",
  expenses: "society:finance.manage",
  reports: "society:finance.read",
  notices: "community:read",
  complaints: "community:helpdesk.respond",
  reminders: "community:notice.manage",
  visitors: "operations:read",
  parking: "operations:read",
  facilities: "operations:booking.manage",
  emergency: "operations:sos.raise",
  documents: "community:read",
  meetings: "community:governance.manage",
  polls: "community:vote.cast",
  settings: "society:settings.manage",
  activity_log: "audit:event.read",
  notifications: "community:read",
  manage_users: "society:core.manage",
};

export function hasLegacyModulePermission(
  role: string,
  societyId: string,
  subject: string,
  module: string,
  mfaVerified = false,
): boolean {
  const action = MODULE_TO_ACTION[module] ?? "community:read";

  const principal = sessionClaimsToPrincipal({
    subject,
    societyId,
    role,
    mfaVerified,
  });

  return evaluatePermission({
    principal,
    action,
    societyId,
  }).allowed;
}

export function isAdminLegacyRole(role: string): boolean {
  return ["chairman", "secretary", "treasurer"].includes(role);
}

export function isCommitteeLegacyRole(role: string): boolean {
  return ["chairman", "secretary"].includes(role);
}
