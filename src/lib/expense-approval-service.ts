import {
  EXPENSE_APPROVAL_STATUS,
  accountCodeForExpenseCategory,
  assertCanApproveExpense,
  assertCanRejectExpense,
  expensePostingLines,
  shouldAutoApproveExpense,
} from "@society/finance-core";
import { postJournalVoucher } from "@/domain/accounting-engine";
import { prisma } from "@/lib/prisma";

function fiscalYearFor(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

function postingLinesForExpense(amount: number, category: string) {
  return expensePostingLines(amount, accountCodeForExpenseCategory(category)).map((line) => ({
    accountCode: line.accountCode,
    debit: line.side === "DEBIT" ? line.amount : 0,
    credit: line.side === "CREDIT" ? line.amount : 0,
    memo: line.memo,
  }));
}

async function incrementBudgetActual(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  societyId: string,
  category: string,
  paidOn: Date,
  amount: number,
) {
  await tx.budget.updateMany({
    where: {
      societyId,
      fiscalYear: fiscalYearFor(paidOn),
      category,
    },
    data: { actual: { increment: amount } },
  });
}

async function postExpenseLedger(
  expense: {
    id: string;
    societyId: string;
    title: string;
    amount: number;
    category: string;
    paidOn: Date;
  },
  createdBy: string,
) {
  const voucher = await postJournalVoucher({
    societyId: expense.societyId,
    createdBy,
    narration: `Expense ${expense.title}`,
    voucherDate: expense.paidOn,
    lines: postingLinesForExpense(expense.amount, expense.category),
    financialSourceType: "EXPENSE",
    financialSourceId: expense.id,
  });

  return voucher.id;
}

export async function finalizeApprovedExpense(input: {
  expenseId: string;
  societyId: string;
  approvedBy: string;
  approvedByUserId: string;
}) {
  const expense = await prisma.expense.findFirst({
    where: { id: input.expenseId, societyId: input.societyId },
  });
  if (!expense) throw new Error("Expense not found");

  assertCanApproveExpense(expense, input.approvedByUserId);

  if (expense.journalVoucherId) {
    return prisma.expense.update({
      where: { id: expense.id },
      data: {
        approvalStatus: EXPENSE_APPROVAL_STATUS.APPROVED,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  const journalVoucherId = await postExpenseLedger(expense, input.approvedBy);

  return prisma.$transaction(async (tx) => {
    await incrementBudgetActual(tx, expense.societyId, expense.category, expense.paidOn, expense.amount);

    return tx.expense.update({
      where: { id: expense.id },
      data: {
        approvalStatus: EXPENSE_APPROVAL_STATUS.APPROVED,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
        journalVoucherId,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    });
  });
}

export async function rejectPendingExpense(input: {
  expenseId: string;
  societyId: string;
  rejectedBy: string;
  reason?: string;
}) {
  const expense = await prisma.expense.findFirst({
    where: { id: input.expenseId, societyId: input.societyId },
  });
  if (!expense) throw new Error("Expense not found");

  assertCanRejectExpense(expense);

  return prisma.expense.update({
    where: { id: expense.id },
    data: {
      approvalStatus: EXPENSE_APPROVAL_STATUS.REJECTED,
      rejectedBy: input.rejectedBy,
      rejectedAt: new Date(),
      rejectionReason: input.reason?.trim() || null,
    },
  });
}

export async function createExpenseWithApproval(input: {
  societyId: string;
  role: string;
  submittedBy: string;
  submittedByUserId: string;
  data: {
    title: string;
    amount: number;
    category: string;
    paidTo: string | null;
    paidOn: Date;
    notes: string | null;
    netPayable: number;
    billProofDataUrl: string | null;
    billProofFileName: string | null;
    billProofFileType: string | null;
  };
}) {
  const autoApprove = shouldAutoApproveExpense(input.role);
  const now = new Date();

  if (autoApprove) {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          societyId: input.societyId,
          title: input.data.title,
          amount: input.data.amount,
          category: input.data.category,
          paidTo: input.data.paidTo,
          paidOn: input.data.paidOn,
          notes: input.data.notes,
          netPayable: input.data.netPayable,
          billProofDataUrl: input.data.billProofDataUrl,
          billProofFileName: input.data.billProofFileName,
          billProofFileType: input.data.billProofFileType,
          billProofUploadedAt: input.data.billProofDataUrl ? now : null,
          approvalStatus: EXPENSE_APPROVAL_STATUS.APPROVED,
          submittedBy: input.submittedBy,
          submittedByUserId: input.submittedByUserId,
          submittedAt: now,
          approvedBy: input.submittedBy,
          approvedAt: now,
        },
      });

      await incrementBudgetActual(
        tx,
        input.societyId,
        input.data.category,
        input.data.paidOn,
        input.data.amount,
      );

      return created;
    });

    const journalVoucherId = await postExpenseLedger(expense, input.submittedBy);

    return prisma.expense.update({
      where: { id: expense.id },
      data: { journalVoucherId },
    });
  }

  return prisma.expense.create({
    data: {
      societyId: input.societyId,
      title: input.data.title,
      amount: input.data.amount,
      category: input.data.category,
      paidTo: input.data.paidTo,
      paidOn: input.data.paidOn,
      notes: input.data.notes,
      netPayable: input.data.netPayable,
      billProofDataUrl: input.data.billProofDataUrl,
      billProofFileName: input.data.billProofFileName,
      billProofFileType: input.data.billProofFileType,
      billProofUploadedAt: input.data.billProofDataUrl ? now : null,
      approvalStatus: EXPENSE_APPROVAL_STATUS.PENDING,
      submittedBy: input.submittedBy,
      submittedByUserId: input.submittedByUserId,
      submittedAt: now,
    },
  });
}

export const APPROVED_EXPENSE_FILTER = {
  approvalStatus: EXPENSE_APPROVAL_STATUS.APPROVED,
} as const;
