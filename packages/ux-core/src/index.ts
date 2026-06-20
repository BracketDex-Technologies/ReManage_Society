export type UxPermissionAction =
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

export type UxPersona =
  | "committee"
  | "treasurer"
  | "resident"
  | "guard"
  | "operations_desk"
  | "platform_admin"
  | "vendor";

export type LegacyRole =
  | "chairman"
  | "secretary"
  | "treasurer"
  | "member"
  | "tenant"
  | "watchman"
  | "guard"
  | "vendor_staff"
  | "facility_manager";

export interface NavItemDefinition {
  href: string;
  label: string;
  iconKey: string;
  sectionTitle: string;
  sectionOrder: number;
  personas: readonly UxPersona[];
  requiredActions: readonly UxPermissionAction[];
  pinned?: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  iconKey: string;
  pinned: boolean;
}

export interface NavigationSection {
  title: string;
  items: NavItem[];
}

export interface NavigationModel {
  persona: UxPersona;
  defaultRoute: string;
  sections: NavigationSection[];
}

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  iconKey: string;
  personas: readonly UxPersona[];
  requiredActions: readonly UxPermissionAction[];
}

export interface SearchResultInput {
  type: string;
  title: string;
  subtitle?: string;
  href: string;
  sensitive?: boolean;
}

export interface SearchResult {
  type: string;
  title: string;
  subtitle?: string;
  href: string;
}

const PERSONA_DEFAULT_ROUTES: Record<UxPersona, string> = {
  committee: "/dashboard",
  treasurer: "/dashboard",
  resident: "/dashboard",
  guard: "/visitors",
  operations_desk: "/amenities",
  platform_admin: "/system",
  vendor: "/dashboard",
};

const LEGACY_ROLE_TO_PERSONA: Record<LegacyRole, UxPersona> = {
  chairman: "committee",
  secretary: "committee",
  treasurer: "treasurer",
  member: "resident",
  tenant: "resident",
  watchman: "guard",
  guard: "guard",
  vendor_staff: "vendor",
  facility_manager: "operations_desk",
};

export const NAV_CATALOG: readonly NavItemDefinition[] = [
  { href: "/dashboard", label: "Dashboard", iconKey: "layout-dashboard", sectionTitle: "", sectionOrder: 0, personas: ["committee", "treasurer", "resident", "operations_desk", "platform_admin", "vendor"], requiredActions: [] },

  { href: "/visitors", label: "Security Gate", iconKey: "shield", sectionTitle: "OPERATIONS", sectionOrder: 1, personas: ["committee", "guard"], requiredActions: ["operations:gate.manage"] },
  { href: "/my-visitors", label: "My Visitors", iconKey: "user-check", sectionTitle: "OPERATIONS", sectionOrder: 1, personas: ["resident"], requiredActions: ["operations:visitor.respond"] },
  { href: "/move-wizard", label: "Move-In / Out", iconKey: "clipboard-list", sectionTitle: "OPERATIONS", sectionOrder: 1, personas: ["resident"], requiredActions: ["tenant:membership.read"] },
  { href: "/staff", label: "Staff & Daily Help", iconKey: "briefcase", sectionTitle: "OPERATIONS", sectionOrder: 1, personas: ["committee", "resident"], requiredActions: ["operations:read"] },
  { href: "/packages", label: "Parcel Desk", iconKey: "package", sectionTitle: "OPERATIONS", sectionOrder: 1, personas: ["committee", "resident", "guard"], requiredActions: ["operations:read"] },

  { href: "/maintenance", label: "Billing & Ledger", iconKey: "receipt", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["committee", "treasurer"], requiredActions: ["society:finance.read"] },
  { href: "/my-bills", label: "My Bills", iconKey: "credit-card", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["resident"], requiredActions: ["society:finance.read"], pinned: true },
  { href: "/noc", label: "Society NOC", iconKey: "file-badge", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["resident"], requiredActions: ["society:finance.read"] },
  { href: "/expenses", label: "Expenses", iconKey: "wallet", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["committee", "treasurer"], requiredActions: ["society:finance.manage"] },
  { href: "/funds", label: "Fund Accounts", iconKey: "piggy-bank", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["committee", "treasurer"], requiredActions: ["society:finance.manage"] },
  { href: "/budgets", label: "Budget Planning", iconKey: "trending-up", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["committee", "treasurer"], requiredActions: ["society:finance.manage"] },
  { href: "/salaries", label: "Staff Payroll", iconKey: "hand-coins", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["committee", "treasurer"], requiredActions: ["society:finance.manage"] },
  { href: "/reports", label: "Reports", iconKey: "bar-chart", sectionTitle: "FINANCE", sectionOrder: 2, personas: ["committee", "treasurer"], requiredActions: ["society:finance.read"] },

  { href: "/notices", label: "Announcements", iconKey: "megaphone", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "treasurer", "resident", "guard"], requiredActions: ["community:read"] },
  { href: "/complaints", label: "Helpdesk", iconKey: "alert-triangle", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "resident"], requiredActions: ["community:helpdesk.respond"] },
  { href: "/directory", label: "Resident Directory", iconKey: "book-open", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee"], requiredActions: ["society:directory.read"] },
  { href: "/forum", label: "Discussion Forum", iconKey: "message-square", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "resident"], requiredActions: ["community:post"] },
  { href: "/events", label: "Events & Calendar", iconKey: "calendar-check", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "resident"], requiredActions: ["community:rsvp.manage"] },
  { href: "/amenities", label: "Amenity Booking", iconKey: "building", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "resident", "operations_desk"], requiredActions: ["operations:booking.manage"] },
  { href: "/marketplace", label: "Buy & Sell", iconKey: "shopping-bag", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "resident"], requiredActions: ["community:read"] },
  { href: "/parking", label: "Parking", iconKey: "car", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "resident"], requiredActions: ["operations:read"] },
  { href: "/emergency", label: "SOS & Safety", iconKey: "phone", sectionTitle: "COMMUNITY", sectionOrder: 3, personas: ["committee", "resident", "guard"], requiredActions: ["operations:sos.raise"] },

  { href: "/meetings", label: "Meetings", iconKey: "file-text", sectionTitle: "GOVERNANCE", sectionOrder: 4, personas: ["committee", "resident"], requiredActions: ["community:read"] },
  { href: "/polls", label: "Polls & Voting", iconKey: "vote", sectionTitle: "GOVERNANCE", sectionOrder: 4, personas: ["committee", "resident"], requiredActions: ["community:vote.cast"] },
  { href: "/documents", label: "Document Vault", iconKey: "folder-open", sectionTitle: "GOVERNANCE", sectionOrder: 4, personas: ["committee", "resident"], requiredActions: ["community:read"] },

  { href: "/members", label: "Residents", iconKey: "users", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee"], requiredActions: ["society:core.manage"] },
  { href: "/tenants", label: "Tenants", iconKey: "user-plus", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee"], requiredActions: ["society:occupancy.manage"] },
  { href: "/move-events", label: "Move In / Out", iconKey: "clipboard-list", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee"], requiredActions: ["society:occupancy.manage"] },
  { href: "/vendors", label: "Vendor Hub", iconKey: "wrench", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee"], requiredActions: ["operations:manage"] },
  { href: "/assets", label: "Asset Register", iconKey: "hard-drive", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee"], requiredActions: ["operations:manage"] },
  { href: "/reminders", label: "Smart Nudges", iconKey: "bell", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee", "treasurer"], requiredActions: ["community:notice.manage"] },
  { href: "/credentials", label: "Access Control", iconKey: "key-round", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee"], requiredActions: ["society:core.manage"] },
  { href: "/activity-log", label: "Audit Trail", iconKey: "history", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee", "treasurer"], requiredActions: ["audit:event.read"] },
  { href: "/settings", label: "Settings", iconKey: "settings", sectionTitle: "MANAGEMENT", sectionOrder: 5, personas: ["committee"], requiredActions: ["society:settings.manage"] },
  { href: "/system/sessions", label: "Platform Console", iconKey: "server", sectionTitle: "PLATFORM", sectionOrder: 6, personas: ["platform_admin"], requiredActions: ["society:onboard"] },
];

export const QUICK_ACTION_CATALOG: readonly QuickAction[] = [
  { id: "pay-bill", label: "Pay bill", href: "/my-bills", iconKey: "credit-card", personas: ["resident"], requiredActions: ["society:finance.read"] },
  { id: "approve-visitor", label: "Approve visitor", href: "/my-visitors", iconKey: "user-check", personas: ["resident"], requiredActions: ["operations:visitor.respond"] },
  { id: "raise-complaint", label: "Raise complaint", href: "/complaints", iconKey: "alert-triangle", personas: ["resident"], requiredActions: ["community:helpdesk.respond"] },
  { id: "raise-sos", label: "Raise SOS", href: "/emergency", iconKey: "phone", personas: ["resident", "guard"], requiredActions: ["operations:sos.raise"] },
  { id: "log-visitor", label: "Log visitor", href: "/visitors", iconKey: "shield", personas: ["guard"], requiredActions: ["operations:gate.manage"] },
  { id: "parcel-desk", label: "Parcel desk", href: "/packages", iconKey: "package", personas: ["guard"], requiredActions: ["operations:read"] },
  { id: "publish-notice", label: "Publish notice", href: "/notices", iconKey: "megaphone", personas: ["committee"], requiredActions: ["community:notice.manage"] },
  { id: "collections", label: "Collections", href: "/maintenance", iconKey: "receipt", personas: ["treasurer", "committee"], requiredActions: ["society:finance.read"] },
  { id: "trial-balance", label: "Trial balance", href: "/reports", iconKey: "bar-chart", personas: ["treasurer"], requiredActions: ["society:finance.read"] },
];

function isLegacyRole(role: string): role is LegacyRole {
  return role in LEGACY_ROLE_TO_PERSONA;
}

export function resolvePersona(
  legacyRole: string,
  platformRoles: readonly string[] = [],
): UxPersona {
  if (platformRoles.includes("platform_admin")) {
    return "platform_admin";
  }

  if (!isLegacyRole(legacyRole)) {
    throw new Error(`Unknown legacy role: ${legacyRole}`);
  }

  return LEGACY_ROLE_TO_PERSONA[legacyRole];
}

export function getDefaultRoute(persona: UxPersona): string {
  return PERSONA_DEFAULT_ROUTES[persona];
}

function hasRequiredActions(
  requiredActions: readonly UxPermissionAction[],
  allowedActions: ReadonlySet<UxPermissionAction>,
): boolean {
  if (requiredActions.length === 0) {
    return true;
  }

  return requiredActions.some((action) => allowedActions.has(action));
}

export function filterNavItems(
  items: readonly NavItemDefinition[],
  persona: UxPersona,
  allowedActions: ReadonlySet<UxPermissionAction>,
): NavItem[] {
  return items
    .filter((item) => item.personas.includes(persona))
    .filter((item) => hasRequiredActions(item.requiredActions, allowedActions))
    .map((item) => ({
      href: item.href,
      label: item.label,
      iconKey: item.iconKey,
      pinned: item.pinned ?? false,
    }))
    .sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });
}

export function buildNavigationModel(
  persona: UxPersona,
  allowedActions: ReadonlySet<UxPermissionAction>,
  catalog: readonly NavItemDefinition[] = NAV_CATALOG,
): NavigationModel {
  const visible = catalog.filter(
    (item) =>
      item.personas.includes(persona) &&
      hasRequiredActions(item.requiredActions, allowedActions),
  );

  const sectionMap = new Map<string, { order: number; items: NavItem[] }>();

  for (const item of visible) {
    const sectionKey = item.sectionTitle;
    const existing = sectionMap.get(sectionKey) ?? { order: item.sectionOrder, items: [] };
    existing.items.push({
      href: item.href,
      label: item.label,
      iconKey: item.iconKey,
      pinned: item.pinned ?? false,
    });
    sectionMap.set(sectionKey, existing);
  }

  const sections = [...sectionMap.entries()]
    .sort((left, right) => left[1].order - right[1].order)
    .map(([title, value]) => ({
      title,
      items: value.items.sort((left, right) => {
        if (left.pinned !== right.pinned) {
          return left.pinned ? -1 : 1;
        }

        return left.label.localeCompare(right.label);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return {
    persona,
    defaultRoute: getDefaultRoute(persona),
    sections,
  };
}

export function buildQuickActions(
  persona: UxPersona,
  allowedActions: ReadonlySet<UxPermissionAction>,
  catalog: readonly QuickAction[] = QUICK_ACTION_CATALOG,
): QuickAction[] {
  return catalog
    .filter((action) => action.personas.includes(persona))
    .filter((action) => hasRequiredActions(action.requiredActions, allowedActions))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function normalizeSearchResult(
  item: SearchResultInput,
  persona: UxPersona,
): SearchResult | null {
  if (persona === "resident" && item.sensitive) {
    return null;
  }

  if (persona === "guard" && item.type === "finance") {
    return null;
  }

  return {
    type: item.type,
    title: item.title.trim(),
    subtitle: item.subtitle?.trim(),
    href: item.href,
  };
}
