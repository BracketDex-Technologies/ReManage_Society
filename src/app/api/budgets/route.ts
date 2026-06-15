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

async function requireFinanceAccess() {
  const session = await getSession();
  if (!session?.societyId) return { error: "Unauthorized", status: 401, session: null };
  if (!["chairman", "treasurer"].includes(session.role)) {
    return { error: "Finance access required", status: 403, session: null };
  }
  return { error: null, status: 200, session };
}

function fiscalWindow(fiscalYear: string) {
  const startYear = Number(fiscalYear.slice(0, 4));
  return {
    gte: new Date(startYear, 3, 1),
    lt: new Date(startYear + 1, 3, 1),
  };
}

function fiscalYearFor(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

function categoryFromFundType(type: string) {
  return defaultExpenseCategoryForFund(type);
}

async function calculateActuals(societyId: string, fiscalYear: string, category: string) {
  const window = fiscalWindow(fiscalYear);
  const expenses = await prisma.expense.findMany({
    where: {
      societyId,
      category,
      approvalStatus: "approved",
      paidOn: window,
    },
    select: { amount: true, fundId: true, title: true },
  });

  const fundDebits = await prisma.fundTransaction.findMany({
    where: {
      type: "debit",
      createdAt: window,
      fund: { societyId },
    },
    include: { fund: { select: { id: true, type: true } } },
  });

  const expenseActual = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const legacyFundDebitActual = fundDebits.reduce((sum, tx) => {
    const inferredCategory = categoryFromFundType(tx.fund.type);
    if (inferredCategory !== category) return sum;

    const alreadyHasExpense = expenses.some((expense) =>
      expense.fundId === tx.fund.id &&
      expense.amount === tx.amount &&
      expense.title === tx.description
    );

    return alreadyHasExpense ? sum : sum + tx.amount;
  }, 0);

  return {
    actual: expenseActual + legacyFundDebitActual,
    actualFromExpenses: expenseActual,
    actualFromFundDebits: legacyFundDebitActual,
  };
}

const LEGACY_ROUTE = "/api/budgets";
const NEST_GET = "/api/v1/finance-core/budgets/list";
const NEST_POST = "/api/v1/finance-core/budgets/create";

async function legacyGET() {
  const { error, status, session } = await requireFinanceAccess();
  if (error) return Response.json({ error }, { status });

  const [budgets, expenses, fundDebits] = await Promise.all([
    prisma.budget.findMany({
      where: { societyId: session!.societyId },
      orderBy: [{ fiscalYear: "desc" }, { category: "asc" }],
    }),
    prisma.expense.findMany({
      where: { societyId: session!.societyId, approvalStatus: "approved" },
      select: { category: true, paidOn: true },
    }),
    prisma.fundTransaction.findMany({
      where: { type: "debit", fund: { societyId: session!.societyId } },
      select: { createdAt: true, fund: { select: { type: true } } },
    }),
  ]);

  const rowKeys = new Set<string>();
  budgets.forEach((budget) => rowKeys.add(`${budget.fiscalYear}:${budget.category}`));
  expenses.forEach((expense) => rowKeys.add(`${fiscalYearFor(expense.paidOn)}:${expense.category}`));
  fundDebits.forEach((tx) => rowKeys.add(`${fiscalYearFor(tx.createdAt)}:${categoryFromFundType(tx.fund.type)}`));
  const budgetByKey = new Map(budgets.map((budget) => [`${budget.fiscalYear}:${budget.category}`, budget]));

  const withActuals = await Promise.all(Array.from(rowKeys).map(async (key) => {
    const [fiscalYear, category] = key.split(":");
    const budget = budgetByKey.get(key);
    const actuals = await calculateActuals(session!.societyId, fiscalYear, category);

    return {
      id: budget?.id || `actual-${fiscalYear}-${category}`,
      fiscalYear,
      category,
      planned: budget?.planned || 0,
      notes: budget?.notes || null,
      createdAt: budget?.createdAt || new Date(),
      updatedAt: budget?.updatedAt || new Date(),
      ...actuals,
    };
  }));

  return Response.json(withActuals.sort((a, b) =>
    b.fiscalYear.localeCompare(a.fiscalYear) || a.category.localeCompare(b.category)
  ));
}

async function legacyPOST(request: Request) {
  const { error, status, session } = await requireFinanceAccess();
  if (error) return Response.json({ error }, { status });

  const body = await request.json();
  const { fiscalYear, category, planned, notes } = body;

  const plannedAmount = parseFloat(planned || "0");
  if (!fiscalYear || !category || !Number.isFinite(plannedAmount) || plannedAmount < 0) {
    return Response.json({ error: "Fiscal year and category are required" }, { status: 400 });
  }
  if (!EXPENSE_CATEGORY_IDS.has(category)) {
    return Response.json({ error: "Invalid budget category" }, { status: 400 });
  }

  const actuals = await calculateActuals(session!.societyId, fiscalYear, category);

  const budget = await prisma.budget.upsert({
    where: {
      societyId_fiscalYear_category: {
        societyId: session!.societyId,
        fiscalYear,
        category,
      },
    },
    create: {
      societyId: session!.societyId,
      fiscalYear,
      category,
      planned: plannedAmount,
      actual: actuals.actual,
      notes: notes || null,
    },
    update: {
      planned: plannedAmount,
      actual: actuals.actual,
      notes: notes || null,
    },
  });

  return Response.json(budget, { status: 201 });
}

export const GET = shimOrFallback({ legacyRoute: "/api/budgets", nestPath: "/api/v1/finance-core", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/budgets", nestPath: "/api/v1/finance-core", method: "POST" }, legacyPOST);
