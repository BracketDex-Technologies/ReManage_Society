export { createAuditEvent } from "./audit-event.ts";
export {
  BFF_BRIDGE_ISSUER,
  getBffBridgeSecret,
  isBffBridgeEnabled,
  mapLegacyRoleToSocietyRoles,
  mintBffBridgeToken,
  sessionClaimsToPrincipal,
  verifyBffBridgeToken,
} from "./bff-bridge-token.ts";
export { evaluatePermission } from "./permission-policy.ts";
export {
  canAccessLegacyRoute,
  getDefaultRouteForRole,
  isAdminLegacyRole,
  isWatchmanLegacyRole,
  resolveRequiredAction,
} from "./legacy-route-policy.ts";
export type { LegacyRouteAccessInput } from "./legacy-route-policy.ts";
export {
  hasLegacyModulePermission,
  isAdminLegacyRole as isAdminRoleFromPolicy,
  isCommitteeLegacyRole,
} from "./legacy-module-policy.ts";
export { mapOidcClaimsToPrincipal } from "./oidc-principal.ts";
export { resolveTenantContext, TenantAccessError } from "./tenant-context.ts";
export type { BffBridgeSessionClaims } from "./bff-bridge-token.ts";
export type { AuditEvent, AuditEventInput, AuditOutcome } from "./audit-event.ts";
export type { OidcClaims } from "./oidc-principal.ts";
export type {
  AuthenticatedPrincipal,
  PermissionAction,
  PlatformRole,
  SocietyMembership,
  SocietyRole,
  TenantContext,
} from "./types.ts";
