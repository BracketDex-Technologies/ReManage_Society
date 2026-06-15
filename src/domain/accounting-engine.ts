import "server-only";

import { prisma } from "@/lib/prisma";
import { DEFAULT_LEDGER_ACCOUNTS, assertBalancedLedger } from "@/domain/accounting";

type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
};

export async function ensureDefaultChartOfAccounts(societyId: string) {
  await prisma.ledgerAccount.createMany({
    data: DEFAULT_LEDGER_ACCOUNTS.map((account) => ({
      societyId,
      code: account.code,
      name: account.name,
      type: account.type,
    })),
    skipDuplicates: true,
  });

  return prisma.ledgerAccount.findMany({
    where: { societyId, isActive: true },
    orderBy: [{ code: "asc" }],
  });
}

export async function nextJournalVoucherNumber(societyId: string, date = new Date()) {
  const year = date.getFullYear();
  const prefix = `JV-${year}-`;
  const count = await prisma.journalVoucher.count({
    where: {
      societyId,
      voucherNumber: { startsWith: prefix },
    },
  });

  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

export async function postJournalVoucher(params: {
  societyId: string;
  createdBy?: string;
  narration: string;
  voucherDate?: Date;
  lines: JournalLineInput[];
  financialSourceType?: string;
  financialSourceId?: string;
}) {
  if (params.lines.length < 2) {
    throw new Error("A journal voucher needs at least two ledger lines");
  }

  const normalizedLines = params.lines.map((line) => ({
    ...line,
    debit: Number(line.debit || 0),
    credit: Number(line.credit || 0),
  }));

  assertBalancedLedger(normalizedLines);
  await ensureDefaultChartOfAccounts(params.societyId);

  const accountCodes = normalizedLines.map((line) => line.accountCode);
  const accounts = await prisma.ledgerAccount.findMany({
    where: {
      societyId: params.societyId,
      code: { in: accountCodes },
      isActive: true,
    },
  });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const missingAccounts = accountCodes.filter((code) => !accountByCode.has(code));

  if (missingAccounts.length > 0) {
    throw new Error(`Ledger account not found: ${missingAccounts.join(", ")}`);
  }

  const voucherDate = params.voucherDate || new Date();
  const voucherNumber = await nextJournalVoucherNumber(params.societyId, voucherDate);

  return prisma.$transaction(async (tx) => {
    const voucher = await tx.journalVoucher.create({
      data: {
        societyId: params.societyId,
        voucherNumber,
        voucherDate,
        narration: params.narration,
        createdBy: params.createdBy,
        postedAt: new Date(),
        lines: {
          create: normalizedLines.map((line) => ({
            accountId: accountByCode.get(line.accountCode)!.id,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
          })),
        },
      },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    const transaction = await tx.financialTransaction.create({
      data: {
        societyId: params.societyId,
        sourceType: params.financialSourceType || "JOURNAL",
        sourceId: params.financialSourceId || voucher.id,
        description: params.narration,
        transactionDate: voucherDate,
        createdBy: params.createdBy,
      },
    });

    await tx.ledgerEntry.createMany({
      data: normalizedLines.map((line) => ({
        societyId: params.societyId,
        transactionId: transaction.id,
        accountId: accountByCode.get(line.accountCode)!.id,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo || params.narration,
        postedAt: voucherDate,
      })),
    });

    return voucher;
  });
}

export async function getTrialBalance(params: {
  societyId: string;
  from?: Date;
  to?: Date;
}) {
  const accounts = await ensureDefaultChartOfAccounts(params.societyId);
  const grouped = await prisma.ledgerEntry.groupBy({
    by: ["accountId"],
    where: {
      societyId: params.societyId,
      postedAt: {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lte: params.to } : {}),
      },
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const sums = new Map(grouped.map((row) => [row.accountId, row._sum]));
  const rows = accounts.map((account) => {
    const sum = sums.get(account.id);
    const debit = sum?.debit || 0;
    const credit = sum?.credit || 0;
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      debit,
      credit,
      balance: debit - credit,
    };
  });

  return {
    rows,
    totals: {
      debit: rows.reduce((sum, row) => sum + row.debit, 0),
      credit: rows.reduce((sum, row) => sum + row.credit, 0),
    },
  };
}
