/**
 * Centralized Role-Based Access Control (RBAC)
 *
 * Route access is enforced via @society/security permission policy.
 * Used by middleware (server-side) and sidebar/nav (client-side).
 */

import {
  canAccessLegacyRoute,
  getDefaultRouteForRole,
  isAdminLegacyRole,
  isWatchmanLegacyRole,
} from "@society/security";

export type UserRole =
  | "chairman"
  | "secretary"
  | "treasurer"
  | "member"
  | "tenant"
  | "watchman"
  | "guard"
  | "vendor_staff"
  | "facility_manager";

export interface RouteAccessContext {
  role: string;
  societyId: string;
  subject: string;
  mfaVerified?: boolean;
}

const CLIENT_NAV_PREFIXES: Record<string, readonly string[]> = {
  watchman: ["/visitors", "/packages", "/gate", "/dashboard"],
  guard: ["/visitors", "/packages", "/gate", "/dashboard"],
  member: [
    "/dashboard",
    "/my-society",
    "/services",
    "/profile",
    "/my-bills",
    "/my-visitors",
    "/complaints",
    "/notices",
    "/directory",
    "/forum",
    "/events",
    "/amenities",
    "/facilities",
    "/marketplace",
    "/parking",
    "/emergency",
    "/meetings",
    "/polls",
    "/documents",
    "/packages",
    "/staff",
    "/noc",
    "/move-wizard",
  ],
  tenant: [
    "/dashboard",
    "/my-society",
    "/services",
    "/profile",
    "/my-bills",
    "/my-visitors",
    "/complaints",
    "/notices",
    "/directory",
    "/forum",
    "/events",
    "/amenities",
    "/facilities",
    "/marketplace",
    "/parking",
    "/emergency",
    "/meetings",
    "/polls",
    "/documents",
    "/packages",
    "/staff",
    "/noc",
    "/move-wizard",
  ],
};

function canAccessWithoutSession(role: string, pathname: string): boolean {
  if (isAdminLegacyRole(role)) {
    return true;
  }

  const prefixes = CLIENT_NAV_PREFIXES[role];
  if (prefixes) {
    return prefixes.some((route) => pathname.startsWith(route));
  }

  return pathname.startsWith("/dashboard");
}

/**
 * Check if a role can access a given pathname using the central permission policy.
 */
export function canAccess(
  role: string,
  pathname: string,
  context?: Omit<RouteAccessContext, "role" | "pathname">,
): boolean {
  if (!context?.societyId || !context?.subject) {
    return canAccessWithoutSession(role, pathname);
  }

  return canAccessLegacyRoute({
    role,
    pathname,
    societyId: context.societyId,
    subject: context.subject,
    mfaVerified: context.mfaVerified,
  });
}

export function getDefaultRoute(role: string): string {
  return getDefaultRouteForRole(role);
}

export function isAdminRole(role: string): boolean {
  return isAdminLegacyRole(role);
}

export function isWatchmanRole(role: string): boolean {
  return isWatchmanLegacyRole(role);
}
