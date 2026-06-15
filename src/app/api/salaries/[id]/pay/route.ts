import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salaryCategoryForStaffRole } from "@/lib/finance-categories";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

function fiscalYearFor(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

const LEGACY_ROUTE = "/api/salaries/[id]/pay";
const NEST_POST = "/api/v1/finance-core/salaries/pay/process";

async function legacyPOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["chairman", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Finance access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const paidVia = body.paidVia || "cash";
  const paidOn = body.paidOn ? new Date(body.paidOn) : new Date();

  const salary = await prisma.staffSalary.findFirst({
    where: { id, societyId: session.societyId },
  });

  if (!salary) {
    return Response.json({ error: "Salary entry not found" }, { status: 404 });
  }
  if (salary.status === "paid") {
    return Response.json({ error: "Salary already paid" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const salaryCategory = salaryCategoryForStaffRole(salary.staffRole);
    const paid = await tx.staffSalary.update({
      where: { id },
      data: {
        status: "paid",
        paidOn,
        paidVia,
      },
    });

    await tx.expense.create({
      data: {
        societyId: session.societyId,
        title: `Salary - ${salary.staffName}`,
        amount: salary.netPay,
        category: salaryCategory,
        paidTo: salary.staffName,
        paidOn,
        notes: `Payroll ${salary.month}${salary.notes ? ` · ${salary.notes}` : ""}`,
        netPayable: salary.netPay,
      },
    });

    await tx.budget.updateMany({
      where: {
        societyId: session.societyId,
        fiscalYear: fiscalYearFor(paidOn),
        category: salaryCategory,
      },
      data: { actual: { increment: salary.netPay } },
    });

    return paid;
  });

  return Response.json(updated);
}

export const POST = shimOrFallback({ legacyRoute: "/api/salaries", nestPath: "/api/v1/finance-core", method: "POST" }, legacyPOST);
