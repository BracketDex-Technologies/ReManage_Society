import {
  buildNavigationModel,
  buildQuickActions,
  resolvePersona,
  type NavigationModel,
  type QuickAction,
  type UxPermissionAction,
  type UxPersona,
} from "@society/ux-core";
import {
  evaluatePermission,
  type AuthenticatedPrincipal,
  type PermissionAction,
  type SocietyRole,
} from "@society/security";
import type { UserRole } from "@/lib/role-access";

const ALL_PERMISSION_ACTIONS: readonly PermissionAction[] = [
  "audit:event.read",
  "society:onboard",
  "society:settings.manage",
  "society:core.manage",
  "society:directory.read",
  "society:finance.manage",
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
];

/** Legacy self-service routes not yet modeled as distinct permission actions. */
const LEGACY_UX_ACTION_SUPPLEMENTS: Partial<Record<UserRole, readonly PermissionAction[]>> = {
  member: ["society:finance.read"],
  tenant: ["society:finance.read"],
};

const LEGACY_ROLE_TO_SOCIETY_ROLES: Record<UserRole, readonly SocietyRole[]> = {
  chairman: ["society_admin"],
  secretary: ["committee"],
  treasurer: ["treasurer"],
  member: ["resident"],
  tenant: ["resident"],
  watchman: ["guard"],
  guard: ["guard"],
  vendor_staff: ["resident"],
  facility_manager: ["committee"],
};

export interface LegacySessionContext {
  subject: string;
  societyId: string;
  role: UserRole | string;
  mfaVerified?: boolean;
  platformRoles?: readonly string[];
}

export function mapLegacyRoleToSocietyRoles(role: string): readonly SocietyRole[] {
  if (!(role in LEGACY_ROLE_TO_SOCIETY_ROLES)) {
    return [];
  }

  return LEGACY_ROLE_TO_SOCIETY_ROLES[role as UserRole];
}

export function buildPrincipalFromLegacySession(
  session: LegacySessionContext,
): AuthenticatedPrincipal {
  const societyRoles = mapLegacyRoleToSocietyRoles(session.role);

  return {
    subject: session.subject,
    memberships:
      societyRoles.length > 0
        ? [
            {
              societyId: session.societyId,
              roles: societyRoles,
              mfaVerified: session.mfaVerified ?? false,
            },
          ]
        : [],
    platformRoles: session.platformRoles?.includes("platform_admin")
      ? ["platform_admin"]
      : [],
  };
}

export function resolveAllowedActions(
  principal: AuthenticatedPrincipal,
  societyId: string,
  legacyRole?: string,
): ReadonlySet<PermissionAction> {
  const allowed = new Set<PermissionAction>();

  for (const action of ALL_PERMISSION_ACTIONS) {
    const decision = evaluatePermission({
      principal,
      action,
      societyId,
    });

    if (decision.allowed) {
      allowed.add(action);
    }
  }

  if (legacyRole && legacyRole in LEGACY_UX_ACTION_SUPPLEMENTS) {
    for (const action of LEGACY_UX_ACTION_SUPPLEMENTS[legacyRole as UserRole] ?? []) {
      allowed.add(action);
    }
  }

  return allowed;
}

export function resolvePersonaFromLegacySession(session: LegacySessionContext): UxPersona {
  return resolvePersona(session.role, session.platformRoles ?? []);
}

export function buildPersonaNavigation(
  session: LegacySessionContext,
): {
  persona: UxPersona;
  navigation: NavigationModel;
  quickActions: QuickAction[];
  allowedActions: ReadonlySet<PermissionAction>;
} {
  const principal = buildPrincipalFromLegacySession(session);
  const persona = resolvePersonaFromLegacySession(session);
  const allowedActions = resolveAllowedActions(principal, session.societyId, session.role);

  return {
    persona,
    navigation: buildNavigationModel(persona, allowedActions as ReadonlySet<UxPermissionAction>),
    quickActions: buildQuickActions(persona, allowedActions as ReadonlySet<UxPermissionAction>),
    allowedActions,
  };
}
