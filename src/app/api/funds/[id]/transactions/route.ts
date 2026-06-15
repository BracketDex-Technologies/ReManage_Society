import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { EXPENSE_CATEGORY_IDS, defaultExpenseCategoryForFund } from "@/lib/finance-categories";


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

async function requireFinanceAccess() {
  const session = await getSession();
  if (!session?.societyId) return { error: "Unauthorized", status: 401, session: null };
  if (!["chairman", "treasurer"].includes(session.role)) {
    return { error: "Finance access required", status: 403, session: null };
  }
  return { error: null, status: 200, session };
}

const LEGACY_ROUTE = "/api/funds/[id]/transactions";
const NEST_GET = "/api/v1/finance-core/funds/transactions/list";
const NEST_POST = "/api/v1/finance-core/funds/transactions/record";

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, session } = await requireFinanceAccess();
  if (error) return Response.json({ error }, { status });

  const { id } = await params;
  const body = await request.json();
  const { type, amount, description, reference, category } = body;

  const amt = parseFloat(amount);
  if (!["credit", "debit"].includes(type) || !amount || !description || !Number.isFinite(amt) || amt <= 0) {
    return Response.json({ error: "type, amount, and description are required" }, { status: 400 });
  }

  const fund = await prisma.fundAccount.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!fund) {
    return Response.json({ error: "Fund not found" }, { status: 404 });
  }

  const newBalance = type === "credit" ? fund.balance + amt : fund.balance - amt;
  if (newBalance < 0) {
    return Response.json({ error: "Insufficient fund balance" }, { status: 400 });
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const fundTransaction = await tx.fundTransaction.create({
      data: {
        fundId: id,
        type,
        amount: amt,
        description,
        reference: reference || null,
        balanceAfter: newBalance,
        createdBy: session!.name,
      },
    });

    await tx.fundAccount.update({
      where: { id },
      data: { balance: newBalance },
    });

    if (type === "debit") {
      const expenseCategory = category || defaultExpenseCategoryForFund(fund.type);
      if (!EXPENSE_CATEGORY_IDS.has(expenseCategory)) {
        throw new Error("Invalid expense category");
      }
      const paidOn = new Date();
      await tx.expense.create({
        data: {
          societyId: session!.societyId,
          title: description,
          amount: amt,
          category: expenseCategory,
          paidTo: null,
          paidOn,
          notes: `Paid from ${fund.name}${reference ? ` · Ref: ${reference}` : ""}`,
          fundId: fund.id,
          netPayable: amt,
        },
      });

      await tx.budget.updateMany({
        where: {
          societyId: session!.societyId,
          fiscalYear: fiscalYearFor(paidOn),
          category: expenseCategory,
        },
        data: { actual: { increment: amt } },
      });
    }

    return fundTransaction;
  });

  return Response.json(transaction, { status: 201 });
}

export const POST = shimOrFallback({ legacyRoute: "/api/funds", nestPath: "/api/v1/finance-core", method: "POST" }, legacyPOST);
