export type RouteDisposition = "keep-bff" | "shim-to-nest" | "deprecate-410" | "remove";

export interface RouteDispositionEntry {
  routePath: string;
  disposition: RouteDisposition;
  nestEquivalent?: string;
  notes?: string;
}

/** Curated dispositions for Phase 8 CP1. Expanded by generate-api-inventory.mjs. */
export const ROUTE_DISPOSITIONS: readonly RouteDispositionEntry[] = [
  { routePath: "/api/auth", disposition: "keep-bff", notes: "JWT session until OIDC web shell" },
  { routePath: "/api/sessions", disposition: "keep-bff" },
  { routePath: "/api/search", disposition: "keep-bff", notes: "Phase 7 command palette BFF" },
  { routePath: "/api/dashboard", disposition: "keep-bff", notes: "Persona dashboard aggregation" },
  { routePath: "/api/push", disposition: "keep-bff", notes: "Push compatibility mode" },
  { routePath: "/api/mobile", disposition: "keep-bff" },
  { routePath: "/api/guard/login", disposition: "keep-bff" },
  { routePath: "/api/guard/join", disposition: "keep-bff" },
  { routePath: "/api/notices", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/notices/*", notes: "CP1 pilot" },
  { routePath: "/api/visitors", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/visitors/*", notes: "CP1 pilot (GET list)" },
  { routePath: "/api/maintenance/bills", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/*", notes: "CP1 deprecation headers; list shim pending finance list API" },
  { routePath: "/api/members", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/society-core/directory/read", notes: "CP1 deprecation headers; full shim pending members list parity" },
  { routePath: "/api/legal-adviser", disposition: "remove", nestEquivalent: "POST /api/v1/community/documents/legal-templates", notes: "Superseded by Phase 6 non-advisory templates" },
  { routePath: "/api/complaints", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/helpdesk/*" },
  { routePath: "/api/documents", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/documents/*" },
  { routePath: "/api/meetings", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/meetings/*" },
  { routePath: "/api/polls", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/polls/*" },
  { routePath: "/api/events", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/events/*" },
  { routePath: "/api/forum", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/forum/*" },
  { routePath: "/api/marketplace", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/community/marketplace/*" },
  { routePath: "/api/packages", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/packages/*" },
  { routePath: "/api/staff", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/staff/*" },
  { routePath: "/api/parking", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/parking/*" },
  { routePath: "/api/facilities", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/amenities/*" },
  { routePath: "/api/assets", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/assets/*" },
  { routePath: "/api/vendors", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/vendors/*" },
  { routePath: "/api/emergency", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/sos/*" },
  { routePath: "/api/blacklist", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/blacklist/*" },
  { routePath: "/api/guard", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/operations/*" },
  { routePath: "/api/accounting", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/*" },
  { routePath: "/api/expenses", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/expenses/record" },
  { routePath: "/api/funds", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/*" },
  { routePath: "/api/budgets", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/*" },
  { routePath: "/api/salaries", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/*" },
  { routePath: "/api/receipts", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/payments/record" },
  { routePath: "/api/my-bills", disposition: "keep-bff", nestEquivalent: "POST /api/v1/finance-core/*", notes: "Resident BFF until UI migrates" },
  { routePath: "/api/rent-invoices", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/invoices/create" },
  { routePath: "/api/reports", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/reports/*" },
  { routePath: "/api/tenants", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/society-core/*" },
  { routePath: "/api/move-events", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/society-core/occupancy/*" },
  { routePath: "/api/directory", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/society-core/directory/read" },
  { routePath: "/api/credentials", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/society-core/credentials/issue" },
  { routePath: "/api/societies", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/society-core/*" },
  { routePath: "/api/system", disposition: "keep-bff", notes: "Platform admin surface" },
  { routePath: "/api/subscription", disposition: "keep-bff" },
  { routePath: "/api/settings", disposition: "keep-bff" },
  { routePath: "/api/activity-log", disposition: "keep-bff" },
  { routePath: "/api/notifications", disposition: "keep-bff" },
  { routePath: "/api/reminders", disposition: "deprecate-410", notes: "Worker envelopes deferred" },
  { routePath: "/api/my-visitors", disposition: "keep-bff", notes: "Resident visitor BFF" },
  { routePath: "/api/maintenance", disposition: "shim-to-nest", nestEquivalent: "POST /api/v1/finance-core/*" },
];

const DISPOSITION_BY_PREFIX = [...ROUTE_DISPOSITIONS].sort(
  (a, b) => b.routePath.length - a.routePath.length,
);

export function resolveRouteDisposition(routeFilePath: string): RouteDispositionEntry {
  const apiPath = routeFilePath
    .replace(/\\/g, "/")
    .replace(/^.*src\/app\/api/, "/api")
    .replace(/\/route\.ts$/, "")
    .replace(/\/\[id\]/g, "/:id")
    .replace(/\/\[billId\]/g, "/:billId")
    .replace(/\/\[threadId\]/g, "/:threadId");

  for (const entry of DISPOSITION_BY_PREFIX) {
    if (apiPath === entry.routePath || apiPath.startsWith(`${entry.routePath}/`)) {
      return entry;
    }
  }

  return {
    routePath: apiPath,
    disposition: "deprecate-410",
    notes: "Unmapped route — default sunset pending inventory review",
  };
}

export function getRemovedRoutes(): readonly string[] {
  return ROUTE_DISPOSITIONS.filter((entry) => entry.disposition === "remove").map(
    (entry) => entry.routePath,
  );
}
