import {
  parseBankStatementRows,
  proposeBankReconciliationMatches,
  summarizeReconciliationSession,
  type ParsedBankStatementRow,
  type RawBankRow,
  type ReconciliationCandidate,
} from "@society/finance-core";
import { prisma } from "@/lib/prisma";

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

async function loadConfirmedSourceIds(societyId: string) {
  const confirmed = await prisma.bankStatementLine.findMany({
    where: {
      societyId,
      matchStatus: "confirmed",
      matchedSourceId: { not: null },
    },
    select: { matchedSourceId: true },
  });
  return new Set(confirmed.map((line) => line.matchedSourceId!).filter(Boolean));
}

export async function loadReconciliationCandidates(societyId: string): Promise<ReconciliationCandidate[]> {
  const confirmedSourceIds = await loadConfirmedSourceIds(societyId);

  const [payments, expenses, expenseTransactions] = await Promise.all([
    prisma.payment.findMany({
      where: {
        societyId,
        status: "SUCCESS",
      },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        reference: true,
        method: true,
        financialTransaction: { select: { id: true, reconciledAt: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 500,
    }),
    prisma.expense.findMany({
      where: { societyId, approvalStatus: "approved" },
      select: {
        id: true,
        amount: true,
        paidOn: true,
        notes: true,
        title: true,
        paidTo: true,
        journalVoucherId: true,
      },
      orderBy: { paidOn: "desc" },
      take: 500,
    }),
    prisma.financialTransaction.findMany({
      where: {
        societyId,
        sourceType: "EXPENSE",
        sourceId: { not: null },
      },
      select: { id: true, sourceId: true, reconciledAt: true },
    }),
  ]);

  const expenseTransactionBySourceId = new Map(
    expenseTransactions.map((tx) => [tx.sourceId!, tx]),
  );

  const paymentCandidates = payments
    .filter((payment) => !payment.financialTransaction?.reconciledAt)
    .filter((payment) => !confirmedSourceIds.has(payment.id))
    .map((payment) => ({
      id: payment.id,
      sourceType: "payment" as const,
      transactionDate: payment.paidAt,
      amount: roundMoney(payment.amount),
      direction: "in" as const,
      reference: payment.reference || payment.invoice?.invoiceNumber || payment.method,
      description: `Payment ${payment.method}${payment.invoice?.invoiceNumber ? ` · ${payment.invoice.invoiceNumber}` : ""}`,
      financialTransactionId: payment.financialTransaction?.id ?? null,
    }));

  const expenseCandidates = expenses
    .filter((expense) => !confirmedSourceIds.has(expense.id))
    .filter((expense) => !expenseTransactionBySourceId.get(expense.id)?.reconciledAt)
    .map((expense) => ({
      id: expense.id,
      sourceType: "expense" as const,
      transactionDate: expense.paidOn,
      amount: roundMoney(expense.amount),
      direction: "out" as const,
      reference: expense.notes || expense.paidTo || expense.title,
      description: expense.title,
      financialTransactionId: expenseTransactionBySourceId.get(expense.id)?.id ?? null,
    }));

  return [...paymentCandidates, ...expenseCandidates];
}

export async function createBankReconciliationSession(input: {
  societyId: string;
  createdBy: string;
  fileName?: string | null;
  rawRows: RawBankRow[];
}) {
  const parsedRows = parseBankStatementRows(input.rawRows);
  if (parsedRows.length === 0) {
    throw new Error("No valid bank statement rows found. Check date, amount, debit/credit columns.");
  }

  const candidates = await loadReconciliationCandidates(input.societyId);
  const matchPlan = proposeBankReconciliationMatches({
    bankRows: parsedRows,
    candidates,
  });
  const summary = summarizeReconciliationSession({
    totalLines: parsedRows.length,
    proposals: matchPlan.proposals,
  });

  const periodStart = parsedRows.reduce(
    (min, row) => (row.transactionDate < min ? row.transactionDate : min),
    parsedRows[0].transactionDate,
  );
  const periodEnd = parsedRows.reduce(
    (max, row) => (row.transactionDate > max ? row.transactionDate : max),
    parsedRows[0].transactionDate,
  );

  const proposalByRow = new Map(matchPlan.proposals.map((proposal) => [proposal.bankRowIndex, proposal]));

  const session = await prisma.$transaction(async (tx) => {
    const createdSession = await tx.bankReconciliationSession.create({
      data: {
        societyId: input.societyId,
        fileName: input.fileName || null,
        periodStart,
        periodEnd,
        status: "draft",
        totalLines: parsedRows.length,
        matchedLines: matchPlan.proposals.length,
        createdBy: input.createdBy,
      },
    });

    await tx.bankStatementLine.createMany({
      data: parsedRows.map((row) => {
        const proposal = proposalByRow.get(row.rowIndex);
        return {
          societyId: input.societyId,
          sessionId: createdSession.id,
          rowIndex: row.rowIndex,
          transactionDate: row.transactionDate,
          amount: row.amount,
          reference: row.reference || null,
          description: row.description || null,
          matchStatus: proposal ? "suggested" : "unmatched",
          matchScore: proposal?.score ?? null,
          matchedSourceType: proposal?.candidateSourceType ?? null,
          matchedSourceId: proposal?.candidateId ?? null,
          financialTransactionId: proposal?.financialTransactionId ?? null,
        };
      }),
    });

    return createdSession;
  });

  return {
    session,
    summary,
    unmatchedBankRows: matchPlan.unmatchedBankRows,
    unusedCandidateIds: matchPlan.unusedCandidateIds,
  };
}

export async function getBankReconciliationSession(societyId: string, sessionId: string) {
  const session = await prisma.bankReconciliationSession.findFirst({
    where: { id: sessionId, societyId },
    include: {
      lines: {
        orderBy: { rowIndex: "asc" },
      },
    },
  });

  if (!session) {
    throw new Error("Reconciliation session not found");
  }

  return session;
}

export async function confirmBankReconciliationSession(input: {
  societyId: string;
  sessionId: string;
  confirmedBy: string;
}) {
  const session = await getBankReconciliationSession(input.societyId, input.sessionId);
  if (session.status === "confirmed") {
    return session;
  }

  const linesToConfirm = session.lines.filter((line) => line.matchStatus === "suggested");

  await prisma.$transaction(async (tx) => {
    for (const line of linesToConfirm) {
      await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
          matchStatus: "confirmed",
          confirmedAt: new Date(),
          confirmedBy: input.confirmedBy,
        },
      });

      if (line.financialTransactionId) {
        await tx.financialTransaction.update({
          where: { id: line.financialTransactionId },
          data: {
            reconciledAt: new Date(),
            reconciledBy: input.confirmedBy,
          },
        });
      }
    }

    await tx.bankReconciliationSession.update({
      where: { id: session.id },
      data: {
        status: "confirmed",
        matchedLines: linesToConfirm.length,
        confirmedAt: new Date(),
        confirmedBy: input.confirmedBy,
      },
    });
  });

  return getBankReconciliationSession(input.societyId, input.sessionId);
}

export function rowsFromObjects(objects: Record<string, string>[]): RawBankRow[] {
  return objects.map((values, rowIndex) => ({ rowIndex, values }));
}

export function periodLabel(start?: Date | null, end?: Date | null) {
  if (!start || !end) return "Uploaded statement";
  const fmt = (date: Date) =>
    date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export type { ParsedBankStatementRow };
