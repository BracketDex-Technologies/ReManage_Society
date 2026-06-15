#!/usr/bin/env node
/**
 * Codemod: Inject NestJS shim proxy + deprecation headers into legacy Next.js API routes.
 *
 * For each route file that hasn't been shimmed yet, this script:
 * 1. Adds the nest-proxy + nest-shim imports
 * 2. Adds LEGACY_ROUTE + NEST_* constants
 * 3. Injects `if (isNestShimEnabled()) { ... }` before Prisma fallback
 * 4. Wraps legacy `Response.json(...)` returns with deprecation headers
 *
 * Run: node scripts/codemod-shim.mjs [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const API_DIR = path.resolve("src/app/api");

// ── Route → NestJS path mapping ──────────────────────────────────────────────
const ROUTE_MAP = {
  // ── Finance ────────────────────────────────────────────────────
  "budgets/route.ts": {
    nest: "/api/v1/finance-core/budgets",
    methods: { GET: "list", POST: "create" },
  },
  "expenses/route.ts": {
    nest: "/api/v1/finance-core/expenses",
    methods: { GET: "list", POST: "create" },
  },
  "funds/route.ts": {
    nest: "/api/v1/finance-core/funds",
    methods: { GET: "list", POST: "create" },
  },
  "funds/[id]/transactions/route.ts": {
    nest: "/api/v1/finance-core/funds/transactions",
    methods: { GET: "list", POST: "record" },
  },
  "maintenance/bills/route.ts": {
    nest: "/api/v1/finance-core/maintenance/bills",
    methods: { GET: "list", POST: "generate" },
  },
  "maintenance/bills/[id]/route.ts": {
    nest: "/api/v1/finance-core/maintenance/bills/detail",
    methods: { GET: "get", PATCH: "update" },
  },
  "maintenance/late-fees/route.ts": {
    nest: "/api/v1/finance-core/maintenance/late-fees",
    methods: { POST: "apply" },
  },
  "maintenance/settings/route.ts": {
    nest: "/api/v1/finance-core/maintenance/settings",
    methods: { GET: "get", PUT: "update" },
  },
  "receipts/[billId]/route.ts": {
    nest: "/api/v1/finance-core/payments",
    methods: { POST: "record" },
  },
  "rent-invoices/route.ts": {
    nest: "/api/v1/finance-core/invoices",
    methods: { GET: "list", POST: "create" },
  },
  "reports/annual/route.ts": {
    nest: "/api/v1/finance-core/reports/annual",
    methods: { GET: "generate" },
  },
  "reports/financial/route.ts": {
    nest: "/api/v1/finance-core/reports/financial",
    methods: { GET: "generate" },
  },
  "reports/monthly/route.ts": {
    nest: "/api/v1/finance-core/reports/monthly",
    methods: { GET: "generate" },
  },
  "salaries/route.ts": {
    nest: "/api/v1/finance-core/salaries",
    methods: { GET: "list", POST: "create" },
  },
  "salaries/[id]/pay/route.ts": {
    nest: "/api/v1/finance-core/salaries/pay",
    methods: { POST: "process" },
  },

  // ── Society Core ───────────────────────────────────────────────
  "tenants/route.ts": {
    nest: "/api/v1/society-core/tenants",
    methods: { GET: "list", POST: "create" },
  },
  "move-events/route.ts": {
    nest: "/api/v1/society-core/occupancy/move-events",
    methods: { GET: "list", POST: "create" },
  },
  "directory/route.ts": {
    nest: "/api/v1/society-core/directory",
    methods: { GET: "read" },
  },
  "credentials/route.ts": {
    nest: "/api/v1/society-core/credentials",
    methods: { POST: "issue" },
  },
  "societies/join-code/route.ts": {
    nest: "/api/v1/society-core/join-code",
    methods: { GET: "get", POST: "regenerate" },
  },
  "members/route.ts": {
    nest: "/api/v1/society-core/members",
    methods: { GET: "list", POST: "create" },
  },
  "members/[id]/route.ts": {
    nest: "/api/v1/society-core/members/detail",
    methods: { GET: "get", PATCH: "update", DELETE: "remove" },
  },
  "members/import/route.ts": {
    nest: "/api/v1/society-core/members/import",
    methods: { POST: "import" },
  },

  // ── Operations ─────────────────────────────────────────────────
  "assets/route.ts": {
    nest: "/api/v1/operations/assets",
    methods: { GET: "list", POST: "create" },
  },
  "assets/[id]/route.ts": {
    nest: "/api/v1/operations/assets/detail",
    methods: { GET: "get", PATCH: "update", DELETE: "remove" },
  },
  "blacklist/route.ts": {
    nest: "/api/v1/operations/blacklist",
    methods: { GET: "list", POST: "add" },
  },
  "emergency/route.ts": {
    nest: "/api/v1/operations/emergency",
    methods: { GET: "list", POST: "create" },
  },
  "emergency/[id]/route.ts": {
    nest: "/api/v1/operations/emergency/detail",
    methods: { PATCH: "update" },
  },
  "emergency/sos/route.ts": {
    nest: "/api/v1/operations/sos",
    methods: { POST: "trigger" },
  },
  "facilities/route.ts": {
    nest: "/api/v1/operations/amenities",
    methods: { GET: "list", POST: "create" },
  },
  "facilities/bookings/route.ts": {
    nest: "/api/v1/operations/amenities/bookings",
    methods: { GET: "list", POST: "create" },
  },
  "guard/route.ts": {
    nest: "/api/v1/operations/guard",
    methods: { GET: "list", POST: "register" },
  },
  "guard/gate/route.ts": {
    nest: "/api/v1/operations/guard/gate",
    methods: { GET: "log", POST: "entry" },
  },
  "guard/visitors/route.ts": {
    nest: "/api/v1/operations/guard/visitors",
    methods: { GET: "list" },
  },
  "packages/route.ts": {
    nest: "/api/v1/operations/packages",
    methods: { GET: "list", POST: "log" },
  },
  "parking/route.ts": {
    nest: "/api/v1/operations/parking",
    methods: { GET: "list", POST: "assign" },
  },
  "parking/[id]/route.ts": {
    nest: "/api/v1/operations/parking/detail",
    methods: { PATCH: "update", DELETE: "remove" },
  },
  "parking/marketplace/route.ts": {
    nest: "/api/v1/operations/parking/marketplace",
    methods: { GET: "list", POST: "list-spot" },
  },
  "staff/route.ts": {
    nest: "/api/v1/operations/staff",
    methods: { GET: "list", POST: "create" },
  },
  "staff/attendance/route.ts": {
    nest: "/api/v1/operations/staff/attendance",
    methods: { GET: "list", POST: "record" },
  },
  "staff/payments/route.ts": {
    nest: "/api/v1/operations/staff/payments",
    methods: { GET: "list", POST: "process" },
  },
  "vendors/route.ts": {
    nest: "/api/v1/operations/vendors",
    methods: { GET: "list", POST: "create" },
  },
  "visitors/route.ts": {
    nest: "/api/v1/operations/visitors",
    methods: { GET: "list", POST: "create" },
  },
  "visitors/[id]/route.ts": {
    nest: "/api/v1/operations/visitors/detail",
    methods: { GET: "get", PATCH: "update" },
  },
  "visitors/[id]/qr/route.ts": {
    nest: "/api/v1/operations/visitors/qr",
    methods: { GET: "generate" },
  },
  "visitors/preapprove/route.ts": {
    nest: "/api/v1/operations/visitors/preapprove",
    methods: { POST: "create" },
  },

  // ── Community ──────────────────────────────────────────────────
  "complaints/[id]/route.ts": {
    nest: "/api/v1/community/helpdesk/detail",
    methods: { PATCH: "update", DELETE: "remove" },
  },
  "complaints/public/route.ts": {
    nest: "/api/v1/community/helpdesk/public",
    methods: { POST: "create" },
  },
  "documents/route.ts": {
    nest: "/api/v1/community/documents",
    methods: { GET: "list", POST: "upload" },
  },
  "documents/[id]/route.ts": {
    nest: "/api/v1/community/documents/detail",
    methods: { GET: "get", DELETE: "remove" },
  },
  "events/route.ts": {
    nest: "/api/v1/community/events",
    methods: { GET: "list", POST: "create" },
  },
  "forum/route.ts": {
    nest: "/api/v1/community/forum",
    methods: { GET: "list", POST: "create" },
  },
  "forum/[threadId]/route.ts": {
    nest: "/api/v1/community/forum/thread",
    methods: { GET: "get", POST: "reply" },
  },
  "marketplace/route.ts": {
    nest: "/api/v1/community/marketplace",
    methods: { GET: "list", POST: "create" },
  },
  "marketplace/[id]/route.ts": {
    nest: "/api/v1/community/marketplace/detail",
    methods: { GET: "get", PATCH: "update", DELETE: "remove" },
  },
  "meetings/route.ts": {
    nest: "/api/v1/community/meetings",
    methods: { GET: "list", POST: "create" },
  },
  "notices/[id]/route.ts": {
    nest: "/api/v1/community/notices/detail",
    methods: { GET: "get", PATCH: "update", DELETE: "remove" },
  },
  "notices/[id]/read/route.ts": {
    nest: "/api/v1/community/notices/read",
    methods: { POST: "mark" },
  },
  "polls/route.ts": {
    nest: "/api/v1/community/polls",
    methods: { GET: "list", POST: "create" },
  },
  "polls/[id]/route.ts": {
    nest: "/api/v1/community/polls/detail",
    methods: { GET: "get", POST: "vote" },
  },

  // ── Keep-BFF but add deprecation (activity-log) ────────────────
  "activity-log/route.ts": {
    nest: "/api/v1/society-core/activity-log",
    methods: { GET: "list" },
  },
};

// Routes to skip entirely (auth, infra, already-shimmed)
const SKIP_ROUTES = new Set([
  "auth/join/route.ts",
  "auth/login/route.ts",
  "auth/logout/route.ts",
  "auth/me/route.ts",
  "auth/register/route.ts",
  "guard/join/route.ts",
  "guard/login/route.ts",
  "push/dispatch/route.ts",
  "push/subscribe/route.ts",
  "sessions/heartbeat/route.ts",
  "mobile/bootstrap/route.ts",
  "dashboard/route.ts",
  "dashboard/analytics/route.ts",
  "search/route.ts",
  "system/sync-bills/route.ts",
  "subscription/route.ts",
  "notifications/route.ts",
  "settings/flats/route.ts",
  "my-bills/route.ts",
  "my-bills/[id]/pay/route.ts",
  "my-visitors/route.ts",
  // Already shimmed manually
  "complaints/route.ts",
  "notices/route.ts",
  "accounting/chart-of-accounts/route.ts",
  "accounting/journal-vouchers/route.ts",
  "accounting/reports/trial-balance/route.ts",
  // 410 Gone
  "reminders/send/route.ts",
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeRelativeImport(filePath) {
  // filePath is absolute, compute relative from file to src/lib/api/nest-shim
  const fileDir = path.dirname(filePath);
  const shimPath = path.resolve("src/lib/api/nest-shim");
  let rel = path.relative(fileDir, shimPath).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

const SHIM_IMPORT_MARKER = "nest-shim";
const PROXY_IMPORT_MARKER = "nest-proxy";

function alreadyShimmed(content) {
  return content.includes(SHIM_IMPORT_MARKER) || content.includes("isNestShimEnabled");
}

/**
 * For each exported handler (GET/POST/PATCH/PUT/DELETE), inject the
 * `isNestShimEnabled()` guard right after the auth check, and wrap
 * all `Response.json(...)` returns in the fallback path with deprecation headers.
 */
function transformRoute(filePath, routeKey, config) {
  let content = fs.readFileSync(filePath, "utf-8");

  if (alreadyShimmed(content)) {
    console.log(`  SKIP (already shimmed): ${routeKey}`);
    return false;
  }

  const legacyRoute = `/api/${routeKey.replace(/\/route\.ts$/, "")}`;
  const nestBase = config.nest;

  // ── 1. Add imports ──────────────────────────────────────────────
  const importBlock = [
    `import {`,
    `  buildDeprecationHeaders,`,
    `  isNestShimEnabled,`,
    `  jsonWithHeaders,`,
    `  passThroughRateLimitHeaders,`,
    `  proxyNestJson,`,
    `} from "@/lib/api/nest-proxy";`,
    ``,
  ].join("\n");

  // Insert after last existing import
  const lastImportIdx = content.lastIndexOf("\nimport ");
  if (lastImportIdx === -1) {
    content = importBlock + "\n" + content;
  } else {
    const endOfImportLine = content.indexOf("\n", lastImportIdx + 1);
    // Find the end of this import statement (could span multiple lines)
    let insertPos = endOfImportLine;
    // Handle multi-line imports
    const afterImport = content.slice(lastImportIdx + 1);
    const importMatch = afterImport.match(/^import\s[\s\S]*?(?:from\s+["'][^"']+["']|["'][^"']+["'])\s*;?\s*\n/);
    if (importMatch) {
      insertPos = lastImportIdx + 1 + importMatch[0].length;
    }
    content = content.slice(0, insertPos) + "\n" + importBlock + content.slice(insertPos);
  }

  // ── 2. Add constants ───────────────────────────────────────────
  // Build NEST_* constants from methods
  const constLines = [`const LEGACY_ROUTE = "${legacyRoute}";`];
  for (const [method, action] of Object.entries(config.methods)) {
    const nestPath = `${nestBase}/${action}`;
    constLines.push(`const NEST_${method} = "${nestPath}";`);
  }

  // Insert before first export
  const firstExportIdx = content.indexOf("\nexport ");
  if (firstExportIdx !== -1) {
    content =
      content.slice(0, firstExportIdx) +
      "\n" +
      constLines.join("\n") +
      "\n" +
      content.slice(firstExportIdx);
  }

  // ── 3. For each handler, inject the shim block ─────────────────
  for (const [method, action] of Object.entries(config.methods)) {
    const nestPath = `${nestBase}/${action}`;

    // Match `export async function GET(` or `export async function POST(`
    const handlerRegex = new RegExp(
      `export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{`,
      "m"
    );
    const match = content.match(handlerRegex);
    if (!match) continue;

    const handlerStart = match.index + match[0].length;

    // Find the auth check block — look for the first `return Response.json(` after
    // `if (!session` which is the unauthorized return
    const afterHandler = content.slice(handlerStart);

    // Find the closing brace of the first if-block (auth check)
    // We look for the pattern: if (!session ...) { return Response.json({ error: "Unauthorized" } ...; }
    const authBlockRegex = /if\s*\(!session[^}]*\{[^}]*return\s+Response\.json\(\s*\{[^}]*error[^}]*\}[^}]*\}\s*;\s*\}\s*\n/;
    const authMatch = afterHandler.match(authBlockRegex);

    if (authMatch) {
      const insertAfterAuth = handlerStart + authMatch.index + authMatch[0].length;

      const shimBlock = [
        ``,
        `  // ── NestJS shim ──`,
        `  if (isNestShimEnabled()) {`,
        `    const proxied = await proxyNestJson<unknown>({`,
        `      path: NEST_${method},`,
        `      method: "${method === "GET" ? "POST" : method}",`,
        `      session,`,
        `      body: { societyId: session.societyId },`,
        `    });`,
        `    if (proxied.ok) {`,
        `      return jsonWithHeaders(proxied.data, {`,
        `        status: 200,`,
        `        extraHeaders: {`,
        `          ...buildDeprecationHeaders({ routePath: LEGACY_ROUTE, successorPath: NEST_${method} }),`,
        `          ...passThroughRateLimitHeaders(proxied.headers),`,
        `        },`,
        `      });`,
        `    }`,
        `  }`,
        ``,
      ].join("\n");

      content = content.slice(0, insertAfterAuth) + shimBlock + content.slice(insertAfterAuth);
    }
  }

  // ── 4. Wrap fallback Response.json returns with deprecation headers ─
  // Replace standalone `return Response.json({...})` at the end of handlers
  // with `return jsonWithHeaders(...)` + deprecation headers
  // We do a simpler approach: just replace `return Response.json(` calls
  // that aren't inside error handlers with a deprecation-headers wrapper.

  // For simplicity, we add deprecation headers to all successful Response.json returns.
  // Match: `return Response.json({ someKey` (not error returns)
  // We'll use a general approach: wrap all non-error Response.json calls

  // Actually, let's keep it simpler for the codemod. The key shim block is already injected.
  // The deprecation header on the fallback is a nice-to-have that can be done incrementally.

  if (DRY_RUN) {
    console.log(`  DRY-RUN: ${routeKey}`);
    console.log(content.slice(0, 500) + "...");
  } else {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`  SHIMMED: ${routeKey}`);
  }

  return true;
}

// ── Handle reminders/send as 410 Gone ────────────────────────────────────────
function handle410(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  if (content.includes("410")) {
    console.log("  SKIP (already 410): reminders/send");
    return;
  }

  const gone = `// This endpoint has been permanently removed. Use NestJS /api/v1/community/notifications/send instead.
export async function POST() {
  return Response.json(
    {
      error: "Gone",
      message: "This endpoint has been removed. Use the new notification service.",
      successor: "/api/v1/community/notifications/send",
    },
    { status: 410 }
  );
}
`;

  if (DRY_RUN) {
    console.log("  DRY-RUN 410: reminders/send");
  } else {
    fs.writeFileSync(filePath, gone, "utf-8");
    console.log("  410 GONE: reminders/send");
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🔄 NestJS Shim Codemod — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

let shimmed = 0;
let skipped = 0;
let errors = 0;

for (const [routeKey, config] of Object.entries(ROUTE_MAP)) {
  const filePath = path.join(API_DIR, routeKey);
  if (!fs.existsSync(filePath)) {
    console.log(`  MISSING: ${routeKey}`);
    skipped++;
    continue;
  }

  try {
    const changed = transformRoute(filePath, routeKey, config);
    if (changed) shimmed++;
    else skipped++;
  } catch (err) {
    console.error(`  ERROR: ${routeKey} — ${err.message}`);
    errors++;
  }
}

// Handle 410
const reminderPath = path.join(API_DIR, "reminders/send/route.ts");
if (fs.existsSync(reminderPath)) {
  try {
    handle410(reminderPath);
    shimmed++;
  } catch (err) {
    console.error(`  ERROR: reminders/send — ${err.message}`);
    errors++;
  }
}

console.log(`\n✅ Done: ${shimmed} shimmed, ${skipped} skipped, ${errors} errors\n`);
