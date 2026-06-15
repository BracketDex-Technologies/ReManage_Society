import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultChartOfAccounts } from "@/domain/accounting-engine";
import { logSecurityEvent } from "@/lib/enterprise-security";
import { shimOrFallback, withDeprecationHeaders } from "@/lib/api/nest-shim";

const ADMIN_ROLES = ["chairman", "secretary", "treasurer"];
const LEGACY_ROUTE = "/api/accounting/chart-of-accounts";

export const GET = shimOrFallback(
  {
    legacyRoute: LEGACY_ROUTE,
    nestPath: "/api/v1/finance-core/accounting/chart-of-accounts/list",
    method: "POST",
    allowedRoles: ADMIN_ROLES,
    responseKey: "accounts",
  },
  async (request: Request) => {
    const session = await getSession();
    if (!session?.societyId || !ADMIN_ROLES.includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await ensureDefaultChartOfAccounts(session.societyId);
    return withDeprecationHeaders(
      Response.json({ accounts }),
      LEGACY_ROUTE,
      "/api/v1/finance-core/accounting/chart-of-accounts/list"
    );
  }
);

export const POST = shimOrFallback(
  {
    legacyRoute: LEGACY_ROUTE,
    nestPath: "/api/v1/finance-core/accounting/chart-of-accounts/create",
    method: "POST",
    allowedRoles: ["chairman", "treasurer"],
    responseKey: "account",
  },
  async (request: Request) => {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "treasurer"].includes(session.role)) {
      await logSecurityEvent({
        societyId: session?.societyId,
        userId: session?.userId,
        eventType: "access_denied",
        severity: "warning",
        path: LEGACY_ROUTE,
      });
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const type = String(body.type || "").trim().toUpperCase();

    if (!code || !name || !["ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"].includes(type)) {
      return Response.json({ error: "Valid account code, name, and type are required" }, { status: 400 });
    }

    const account = await prisma.ledgerAccount.create({
      data: {
        societyId: session.societyId,
        code,
        name,
        type,
        parentId: body.parentId || null,
      },
    });

    return withDeprecationHeaders(
      Response.json({ account }, { status: 201 }),
      LEGACY_ROUTE,
      "/api/v1/finance-core/accounting/chart-of-accounts/create"
    );
  }
);
