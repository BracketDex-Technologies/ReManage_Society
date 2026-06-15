import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logCreated } from "@/lib/activity-log";
import { EXPENSE_CATEGORY_IDS } from "@/lib/finance-categories";
import {
  APPROVED_EXPENSE_FILTER,
  createExpenseWithApproval,
  finalizeApprovedExpense,
  rejectPendingExpense,
} from "@/lib/expense-approval-service";
import {
  EXPENSE_APPROVAL_STATUS,
  isExpenseCheckerRole,
} from "@society/finance-core";

import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const MAX_PROOF_DATA_URL_LENGTH = 4_450_000;
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function actorLabel(session: { name: string; email: string; role: string }) {
  return session.name || session.email || session.role;
}

function validateBillProof(input: {
  billProofDataUrl?: unknown;
  billProofFileName?: unknown;
  billProofFileType?: unknown;
}) {
  const billProofDataUrl = typeof input.billProofDataUrl === "string" ? input.billProofDataUrl : "";
  const billProofFileName = typeof input.billProofFileName === "string" ? input.billProofFileName.trim() : "";
  const billProofFileType = typeof input.billProofFileType === "string" ? input.billProofFileType.trim() : "";

  if (!billProofDataUrl && !billProofFileName && !billProofFileType) {
    return { billProofDataUrl: null, billProofFileName: null, billProofFileType: null };
  }

  if (!billProofDataUrl || !billProofFileName || !billProofFileType) {
    throw new Error("Bill proof file, name, and type must be uploaded together");
  }
  if (!ALLOWED_PROOF_TYPES.has(billProofFileType)) {
    throw new Error("Only JPG, PNG, WebP, or PDF bills are allowed");
  }
  if (!billProofDataUrl.startsWith(`data:${billProofFileType};base64,`)) {
    throw new Error("Invalid bill proof file");
  }
  if (billProofDataUrl.length > MAX_PROOF_DATA_URL_LENGTH) {
    throw new Error("Bill proof must be under 3 MB");
  }

  return { billProofDataUrl, billProofFileName, billProofFileType };
}

const LEGACY_ROUTE = "/api/expenses";
const NEST_GET = "/api/v1/finance-core/expenses/list";
const NEST_POST = "/api/v1/finance-core/expenses/create";

async function legacyGET(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "";
  const month = searchParams.get("month") || "";
  const statusFilter = searchParams.get("status") || "";

  const where: Record<string, unknown> = { societyId: session!.societyId };

  if (category) where.category = category;
  if (statusFilter === "pending") {
    where.approvalStatus = EXPENSE_APPROVAL_STATUS.PENDING;
  } else if (statusFilter === "approved") {
    where.approvalStatus = EXPENSE_APPROVAL_STATUS.APPROVED;
  } else if (statusFilter === "rejected") {
    where.approvalStatus = EXPENSE_APPROVAL_STATUS.REJECTED;
  }
  if (month) {
    const [year, m] = month.split("-").map(Number);
    where.paidOn = {
      gte: new Date(year, m - 1, 1),
      lt: new Date(year, m, 1),
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: [{ approvalStatus: "asc" }, { paidOn: "desc" }],
  });

  const approvedExpenses = expenses.filter((e) => e.approvalStatus === EXPENSE_APPROVAL_STATUS.APPROVED);
  const total = approvedExpenses.reduce((s, e) => s + e.amount, 0);
  const pendingApprovalCount = expenses.filter((e) => e.approvalStatus === EXPENSE_APPROVAL_STATUS.PENDING).length;

  return Response.json({
    expenses,
    total,
    pendingApprovalCount,
    viewerRole: session.role,
    canApprove: isExpenseCheckerRole(session.role),
  });
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, amount, category, paidTo, paidOn, notes } = body;

    const parsedAmount = parseFloat(amount);
    if (!title || !amount || !category || !paidOn || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return Response.json({ error: "Title, amount, category, and date are required" }, { status: 400 });
    }
    if (!EXPENSE_CATEGORY_IDS.has(category)) {
      return Response.json({ error: "Invalid expense category" }, { status: 400 });
    }
    const proof = validateBillProof(body);

    const expenseDate = new Date(paidOn);
    const expense = await createExpenseWithApproval({
      societyId: session.societyId,
      role: session.role,
      submittedBy: actorLabel(session),
      submittedByUserId: session.userId,
      data: {
        title: title.trim(),
        amount: parsedAmount,
        category,
        paidTo: paidTo?.trim() || null,
        paidOn: expenseDate,
        notes: notes?.trim() || null,
        netPayable: parsedAmount,
        billProofDataUrl: proof.billProofDataUrl,
        billProofFileName: proof.billProofFileName,
        billProofFileType: proof.billProofFileType,
      },
    });

    const submittedForApproval = expense.approvalStatus === EXPENSE_APPROVAL_STATUS.PENDING;

    await logCreated("expense", expense.id, `${title} - ₹${amount}`, {
      category,
      paidTo,
      amount: parsedAmount,
      billProofAttached: Boolean(proof.billProofDataUrl),
      approvalStatus: expense.approvalStatus,
    });

    return Response.json(
      {
        expense,
        message: submittedForApproval
          ? "Expense submitted for treasurer approval"
          : "Expense recorded and posted to ledger",
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return Response.json({ error: message }, { status: message === "Something went wrong" ? 500 : 400 });
  }
}

async function legacyPATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const expenseId = typeof body.expenseId === "string" ? body.expenseId : "";
    const action = typeof body.action === "string" ? body.action : "";

    if (!expenseId) {
      return Response.json({ error: "Expense id is required" }, { status: 400 });
    }

    if (action === "approve_expense") {
      if (!isExpenseCheckerRole(session.role)) {
        return Response.json({ error: "Treasurer approval required" }, { status: 403 });
      }

      const updated = await finalizeApprovedExpense({
        expenseId,
        societyId: session.societyId,
        approvedBy: actorLabel(session),
        approvedByUserId: session.userId,
      });

      await logCreated("expense", expenseId, `${updated.title} approved`, {
        action,
        amount: updated.amount,
        category: updated.category,
      });

      return Response.json({ expense: updated, message: "Expense approved and posted to ledger" });
    }

    if (action === "reject_expense") {
      if (!isExpenseCheckerRole(session.role)) {
        return Response.json({ error: "Treasurer approval required" }, { status: 403 });
      }

      const reason = typeof body.reason === "string" ? body.reason : "";
      const updated = await rejectPendingExpense({
        expenseId,
        societyId: session.societyId,
        rejectedBy: actorLabel(session),
        reason,
      });

      await logCreated("expense", expenseId, `${updated.title} rejected`, {
        action,
        reason: reason || null,
      });

      return Response.json({ expense: updated, message: "Expense rejected" });
    }

    if (!["verify_proof", "unverify_proof"].includes(action)) {
      return Response.json({ error: "Invalid expense action" }, { status: 400 });
    }

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, societyId: session.societyId },
    });
    if (!expense) return Response.json({ error: "Expense not found" }, { status: 404 });
    if (!expense.billProofDataUrl) {
      return Response.json({ error: "Attach a bill proof before verification" }, { status: 400 });
    }

    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: action === "verify_proof"
        ? { billProofVerifiedAt: new Date(), billProofVerifiedBy: actorLabel(session) }
        : { billProofVerifiedAt: null, billProofVerifiedBy: null },
    });

    await logCreated("expense", expense.id, `${expense.title} proof ${action === "verify_proof" ? "verified" : "unverified"}`, {
      action,
      amount: expense.amount,
      category: expense.category,
    });

    return Response.json({ expense: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return Response.json({ error: message }, { status: message === "Something went wrong" ? 500 : 400 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/expenses", nestPath: "/api/v1/finance-core/expenses/record", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/expenses", nestPath: "/api/v1/finance-core/expenses/record", method: "POST" }, legacyPOST);
export const PATCH = shimOrFallback({ legacyRoute: "/api/expenses", nestPath: "/api/v1/finance-core/expenses/record", method: "PATCH" }, legacyPATCH);

export { APPROVED_EXPENSE_FILTER };
