import { evaluatePermission } from "./permission-policy.ts";
import { mapLegacyRoleToSocietyRoles, sessionClaimsToPrincipal } from "./bff-bridge-token.ts";
import type { PermissionAction } from "./types.ts";

const UNIVERSAL_ROUTE_PREFIXES = [
  "/dashboard",
  "/api/auth",
  "/api/dashboard",
  "/api/mobile",
  "/api/notifications",
  "/api/push",
  "/api/search",
  "/profile",
  "/my-society",
  "/services",
] as const;

const ROUTE_REQUIRED_ACTIONS: readonly { prefix: string; action: PermissionAction }[] = [
  { prefix: "/api/maintenance", action: "society:finance.read" },
  { prefix: "/maintenance", action: "society:finance.read" },
  { prefix: "/api/my-bills", action: "society:finance.read" },
  { prefix: "/my-bills", action: "society:finance.read" },
  { prefix: "/api/rent-invoices", action: "society:finance.read" },
  { prefix: "/api/receipts", action: "society:finance.read" },
  { prefix: "/receipts", action: "society:finance.read" },
  { prefix: "/api/reports", action: "society:finance.read" },
  { prefix: "/reports", action: "society:finance.read" },
  { prefix: "/api/expenses", action: "society:finance.manage" },
  { prefix: "/expenses", action: "society:finance.manage" },
  { prefix: "/api/funds", action: "society:finance.manage" },
  { prefix: "/funds", action: "society:finance.manage" },
  { prefix: "/api/budgets", action: "society:finance.manage" },
  { prefix: "/budgets", action: "society:finance.manage" },
  { prefix: "/api/salaries", action: "society:finance.manage" },
  { prefix: "/salaries", action: "society:finance.manage" },
  { prefix: "/api/accounting", action: "society:finance.manage" },
  { prefix: "/api/members", action: "society:core.manage" },
  { prefix: "/members", action: "society:core.manage" },
  { prefix: "/api/tenants", action: "society:occupancy.manage" },
  { prefix: "/tenants", action: "society:occupancy.manage" },
  { prefix: "/api/move-wizard", action: "society:finance.read" },
  { prefix: "/move-wizard", action: "society:finance.read" },
  { prefix: "/api/noc", action: "society:finance.read" },
  { prefix: "/noc", action: "society:finance.read" },
  { prefix: "/api/move-events", action: "society:occupancy.manage" },
  { prefix: "/move-events", action: "society:occupancy.manage" },
  { prefix: "/api/credentials", action: "society:import.manage" },
  { prefix: "/credentials", action: "society:core.manage" },
  { prefix: "/api/settings", action: "society:settings.manage" },
  { prefix: "/settings", action: "society:settings.manage" },
  { prefix: "/api/activity-log", action: "audit:event.read" },
  { prefix: "/activity-log", action: "audit:event.read" },
  { prefix: "/api/visitors", action: "operations:read" },
  { prefix: "/visitors", action: "operations:read" },
  { prefix: "/api/my-visitors", action: "operations:visitor.respond" },
  { prefix: "/my-visitors", action: "operations:visitor.respond" },
  { prefix: "/api/packages", action: "operations:read" },
  { prefix: "/packages", action: "operations:read" },
  { prefix: "/api/guard", action: "operations:gate.manage" },
  { prefix: "/gate", action: "operations:gate.manage" },
  { prefix: "/api/staff", action: "operations:read" },
  { prefix: "/staff", action: "operations:read" },
  { prefix: "/api/parking", action: "operations:read" },
  { prefix: "/parking", action: "operations:read" },
  { prefix: "/api/facilities", action: "operations:booking.manage" },
  { prefix: "/facilities", action: "operations:booking.manage" },
  { prefix: "/api/amenities", action: "operations:booking.manage" },
  { prefix: "/amenities", action: "operations:booking.manage" },
  { prefix: "/api/assets", action: "operations:manage" },
  { prefix: "/assets", action: "operations:manage" },
  { prefix: "/api/vendors", action: "operations:manage" },
  { prefix: "/vendors", action: "operations:manage" },
  { prefix: "/api/emergency", action: "operations:sos.raise" },
  { prefix: "/emergency", action: "operations:sos.raise" },
  { prefix: "/api/blacklist", action: "operations:manage" },
  { prefix: "/api/notices", action: "community:read" },
  { prefix: "/notices", action: "community:read" },
  { prefix: "/api/complaints", action: "community:helpdesk.respond" },
  { prefix: "/complaints", action: "community:helpdesk.respond" },
  { prefix: "/api/documents", action: "community:read" },
  { prefix: "/documents", action: "community:read" },
  { prefix: "/api/meetings", action: "community:governance.manage" },
  { prefix: "/meetings", action: "community:governance.manage" },
  { prefix: "/api/polls", action: "community:vote.cast" },
  { prefix: "/polls", action: "community:vote.cast" },
  { prefix: "/api/events", action: "community:rsvp.manage" },
  { prefix: "/events", action: "community:rsvp.manage" },
  { prefix: "/api/forum", action: "community:post" },
  { prefix: "/forum", action: "community:post" },
  { prefix: "/api/marketplace", action: "community:read" },
  { prefix: "/marketplace", action: "community:read" },
  { prefix: "/api/directory", action: "society:directory.read" },
  { prefix: "/directory", action: "society:directory.read" },
  { prefix: "/api/reminders", action: "community:notice.manage" },
  { prefix: "/reminders", action: "community:notice.manage" },
  { prefix: "/api/system", action: "audit:event.read" },
  { prefix: "/system", action: "audit:event.read" },
];

const SORTED_ROUTE_RULES = [...ROUTE_REQUIRED_ACTIONS].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

export interface LegacyRouteAccessInput {
  role: string;
  societyId: string;
  subject: string;
  pathname: string;
  mfaVerified?: boolean;
}

export function resolveRequiredAction(pathname: string): PermissionAction | null {
  if (UNIVERSAL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  for (const rule of SORTED_ROUTE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.action;
    }
  }

  return "community:read";
}

export function canAccessLegacyRoute(input: LegacyRouteAccessInput): boolean {
  const requiredAction = resolveRequiredAction(input.pathname);

  if (!requiredAction) {
    return true;
  }

  if (mapLegacyRoleToSocietyRoles(input.role).length === 0) {
    return false;
  }

  const principal = sessionClaimsToPrincipal({
    subject: input.subject,
    societyId: input.societyId,
    role: input.role,
    mfaVerified: input.mfaVerified ?? false,
  });

  return evaluatePermission({
    principal,
    action: requiredAction,
    societyId: input.societyId,
  }).allowed;
}

export function getDefaultRouteForRole(role: string): string {
  switch (role) {
    case "watchman":
    case "guard":
      return "/visitors";
    default:
      return "/dashboard";
  }
}

export function isAdminLegacyRole(role: string): boolean {
  return ["chairman", "secretary", "treasurer"].includes(role);
}

export function isWatchmanLegacyRole(role: string): boolean {
  return ["watchman", "guard"].includes(role);
}
