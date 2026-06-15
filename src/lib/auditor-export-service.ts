import JSZip from "jszip";
import {
  auditorExportManifest,
  auditorExportZipName,
  balanceSheetToCsv,
  currentIndianFiscalYear,
  decodeProofDataUrl,
  expenseProofZipPath,
  expenseRegisterToCsv,
  fiscalYearWindow,
  incomeRegisterToCsv,
  journalVouchersToCsv,
  ledgerEntriesToCsv,
  profitAndLossToCsv,
  trialBalanceToCsv,
} from "@society/finance-core";
import { getTrialBalance } from "@/domain/accounting-engine";
import { prisma } from "@/lib/prisma";

export type AuditorExportInput = {
  societyId: string;
  exportedBy: string;
  from?: Date;
  to?: Date;
  fiscalYear?: string;
};

export type AuditorExportResult = {
  zipBuffer: Buffer;
  fileName: string;
  periodLabel: string;
};

function resolvePeriod(input: AuditorExportInput) {
  if (input.from && input.to) {
    const fmt = (date: Date) =>
      date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return {
      from: input.from,
      to: input.to,
      label: `${fmt(input.from)} – ${fmt(input.to)}`,
    };
  }

  const fiscalYear = input.fiscalYear || currentIndianFiscalYear();
  const window = fiscalYearWindow(fiscalYear);
  return {
    from: window.from,
    to: window.to,
    label: window.label,
  };
}

export async function buildAuditorExportZip(input: AuditorExportInput): Promise<AuditorExportResult> {
  const period = resolvePeriod(input);

  const society = await prisma.society.findUnique({
    where: { id: input.societyId },
    select: { name: true },
  });
  if (!society) {
    throw new Error("Society not found");
  }

  const [trialBalance, ledgerEntries, expenses, paidBills, journalVouchers] = await Promise.all([
    getTrialBalance({
      societyId: input.societyId,
      from: period.from,
      to: period.to,
    }),
    prisma.ledgerEntry.findMany({
      where: {
        societyId: input.societyId,
        postedAt: { gte: period.from, lte: period.to },
      },
      include: {
        account: { select: { code: true, name: true, type: true } },
        transaction: { select: { sourceType: true, sourceId: true, description: true } },
      },
      orderBy: [{ postedAt: "asc" }, { id: "asc" }],
    }),
    prisma.expense.findMany({
      where: {
        societyId: input.societyId,
        approvalStatus: "approved",
        paidOn: { gte: period.from, lte: period.to },
      },
      orderBy: { paidOn: "asc" },
    }),
    prisma.maintenanceBill.findMany({
      where: {
        societyId: input.societyId,
        status: { in: ["paid", "partial"] },
        paidAt: { gte: period.from, lte: period.to },
      },
      include: {
        flat: { select: { flatNumber: true, ownerName: true } },
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.journalVoucher.findMany({
      where: {
        societyId: input.societyId,
        voucherDate: { gte: period.from, lte: period.to },
      },
      orderBy: { voucherDate: "asc" },
    }),
  ]);

  const zip = new JSZip();
  const fileList: string[] = [];

  const trialBalanceCsv = trialBalanceToCsv(trialBalance.rows, trialBalance.totals);
  zip.file("trial_balance.csv", trialBalanceCsv);
  fileList.push("trial_balance.csv");

  const balanceSheetCsv = balanceSheetToCsv(trialBalance.rows);
  zip.file("balance_sheet.csv", balanceSheetCsv);
  fileList.push("balance_sheet.csv");

  const pnlCsv = profitAndLossToCsv(trialBalance.rows);
  zip.file("profit_and_loss.csv", pnlCsv);
  fileList.push("profit_and_loss.csv");

  const ledgerCsv = ledgerEntriesToCsv(
    ledgerEntries.map((entry) => ({
      postedAt: entry.postedAt,
      accountCode: entry.account.code,
      accountName: entry.account.name,
      accountType: entry.account.type,
      debit: entry.debit,
      credit: entry.credit,
      memo: entry.memo,
      sourceType: entry.transaction.sourceType,
      sourceId: entry.transaction.sourceId,
      description: entry.transaction.description,
    })),
  );
  zip.file("ledger_entries.csv", ledgerCsv);
  fileList.push("ledger_entries.csv");

  const expenseCsv = expenseRegisterToCsv(expenses);
  zip.file("expense_register.csv", expenseCsv);
  fileList.push("expense_register.csv");

  const incomeCsv = incomeRegisterToCsv(
    paidBills
      .filter((bill) => bill.paidAt)
      .map((bill) => ({
        paidAt: bill.paidAt!,
        flatNumber: bill.flat.flatNumber,
        ownerName: bill.flat.ownerName || "—",
        amount: bill.paidAmount || bill.amount,
        method: bill.paidVia || "unknown",
        reference: bill.receiptNumber || bill.receiptNote,
        period: bill.period,
      })),
  );
  zip.file("income_register.csv", incomeCsv);
  fileList.push("income_register.csv");

  const journalCsv = journalVouchersToCsv(journalVouchers);
  zip.file("journal_vouchers.csv", journalCsv);
  fileList.push("journal_vouchers.csv");

  let proofCount = 0;
  for (const expense of expenses) {
    if (!expense.billProofDataUrl) continue;
    const buffer = decodeProofDataUrl(expense.billProofDataUrl);
    if (!buffer) continue;
    const path = expenseProofZipPath(expense);
    zip.file(path, buffer);
    proofCount += 1;
  }
  if (proofCount > 0) {
    fileList.push(`expense_proofs/ (${proofCount} files)`);
  }

  const manifest = auditorExportManifest({
    societyName: society.name,
    periodLabel: period.label,
    exportedAt: new Date().toISOString(),
    exportedBy: input.exportedBy,
    fileList,
    stats: {
      ledgerEntryCount: ledgerEntries.length,
      expenseCount: expenses.length,
      proofCount,
      incomeReceiptCount: paidBills.length,
    },
  });
  zip.file("README.txt", manifest);
  fileList.unshift("README.txt");

  const zipBuffer = Buffer.from(await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" }));

  return {
    zipBuffer,
    fileName: auditorExportZipName(society.name, period.label),
    periodLabel: period.label,
  };
}
