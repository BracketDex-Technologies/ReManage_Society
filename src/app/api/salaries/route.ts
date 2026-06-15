import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

async function requireFinanceAccess() {
  const session = await getSession();
  if (!session?.societyId) return { error: "Unauthorized", status: 401, session: null };
  if (!["chairman", "treasurer"].includes(session.role)) {
    return { error: "Finance access required", status: 403, session: null };
  }
  return { error: null, status: 200, session };
}

const LEGACY_ROUTE = "/api/salaries";
const NEST_GET = "/api/v1/finance-core/salaries/list";
const NEST_POST = "/api/v1/finance-core/salaries/create";

async function legacyGET() {
  const { error, status, session } = await requireFinanceAccess();
  if (error) return Response.json({ error }, { status });

  const salaries = await prisma.staffSalary.findMany({
    where: { societyId: session!.societyId },
    orderBy: [{ month: "desc" }, { staffName: "asc" }],
  });

  return Response.json(salaries);
}

async function legacyPOST(request: Request) {
  const { error, status, session } = await requireFinanceAccess();
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  const { staffName, staffRole, month, basicPay, overtime, deductions, bonus, notes } = body;

  if (!staffName || !staffRole || !month || !basicPay) {
    return Response.json({ error: "staffName, staffRole, month, and basicPay are required" }, { status: 400 });
  }

  const basic = parseFloat(basicPay);
  const ot = parseFloat(overtime || "0");
  const ded = parseFloat(deductions || "0");
  const bon = parseFloat(bonus || "0");
  const netPay = basic + ot + bon - ded;
  if (![basic, ot, ded, bon, netPay].every(Number.isFinite) || basic <= 0 || netPay < 0) {
    return Response.json({ error: "Enter valid salary amounts" }, { status: 400 });
  }

  const salary = await prisma.staffSalary.upsert({
    where: {
      societyId_staffName_month: {
        societyId: session!.societyId,
        staffName,
        month,
      },
    },
    create: {
      societyId: session!.societyId,
      staffName,
      staffRole,
      month,
      basicPay: basic,
      overtime: ot,
      deductions: ded,
      bonus: bon,
      netPay,
      notes: notes || null,
    },
    update: {
      basicPay: basic,
      overtime: ot,
      deductions: ded,
      bonus: bon,
      netPay,
      notes: notes || null,
    },
  });

  return Response.json(salary, { status: 201 });
}

export const GET = shimOrFallback({ legacyRoute: "/api/salaries", nestPath: "/api/v1/finance-core", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/salaries", nestPath: "/api/v1/finance-core", method: "POST" }, legacyPOST);
