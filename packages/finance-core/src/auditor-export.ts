export type TrialBalanceExportRow = {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

export type BalanceSheetSection = {
  label: string;
  lines: Array<{ code: string; name: string; amount: number }>;
  total: number;
};

export type AuditorExportManifestInput = {
  societyName: string;
  periodLabel: string;
  exportedAt: string;
  exportedBy: string;
  fileList: string[];
  stats: {
    ledgerEntryCount: number;
    expenseCount: number;
    proofCount: number;
    incomeReceiptCount: number;
  };
};

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function trialBalanceToCsv(rows: TrialBalanceExportRow[], totals: { debit: number; credit: number }) {
  return rowsToCsv(
    ["Account Code", "Account Name", "Type", "Debit", "Credit", "Balance"],
    [
      ...rows.map((row) => [row.code, row.name, row.type, row.debit, row.credit, row.balance]),
      ["", "TOTAL", "", totals.debit, totals.credit, roundMoney(totals.debit - totals.credit)],
    ],
  );
}

function signedBalance(row: TrialBalanceExportRow): number {
  if (row.type === "ASSET" || row.type === "EXPENSE") {
    return roundMoney(row.debit - row.credit);
  }
  return roundMoney(row.credit - row.debit);
}

export function buildProfitAndLossSections(rows: TrialBalanceExportRow[]) {
  const incomeLines = rows
    .filter((row) => row.type === "INCOME")
    .map((row) => ({ code: row.code, name: row.name, amount: signedBalance(row) }))
    .filter((line) => line.amount !== 0);

  const expenseLines = rows
    .filter((row) => row.type === "EXPENSE")
    .map((row) => ({ code: row.code, name: row.name, amount: signedBalance(row) }))
    .filter((line) => line.amount !== 0);

  const totalIncome = roundMoney(incomeLines.reduce((sum, line) => sum + line.amount, 0));
  const totalExpense = roundMoney(expenseLines.reduce((sum, line) => sum + line.amount, 0));

  return {
    incomeLines,
    expenseLines,
    totalIncome,
    totalExpense,
    netSurplus: roundMoney(totalIncome - totalExpense),
  };
}

export function profitAndLossToCsv(rows: TrialBalanceExportRow[]) {
  const pnl = buildProfitAndLossSections(rows);
  const csvRows: Array<Array<string | number>> = [
    ["Income", "", ""],
    ...pnl.incomeLines.map((line) => [line.code, line.name, line.amount]),
    ["", "Total Income", pnl.totalIncome],
    ["", "", ""],
    ["Expenses", "", ""],
    ...pnl.expenseLines.map((line) => [line.code, line.name, line.amount]),
    ["", "Total Expenses", pnl.totalExpense],
    ["", "Net Surplus / (Deficit)", pnl.netSurplus],
  ];
  return rowsToCsv(["Section / Code", "Description", "Amount"], csvRows);
}

export function buildBalanceSheetSections(rows: TrialBalanceExportRow[]) {
  const assetLines = rows
    .filter((row) => row.type === "ASSET")
    .map((row) => ({ code: row.code, name: row.name, amount: signedBalance(row) }))
    .filter((line) => line.amount !== 0);

  const liabilityLines = rows
    .filter((row) => row.type === "LIABILITY")
    .map((row) => ({ code: row.code, name: row.name, amount: signedBalance(row) }))
    .filter((line) => line.amount !== 0);

  const equityLines = rows
    .filter((row) => row.type === "EQUITY")
    .map((row) => ({ code: row.code, name: row.name, amount: signedBalance(row) }))
    .filter((line) => line.amount !== 0);

  const pnl = buildProfitAndLossSections(rows);
  const retainedSurplus = pnl.netSurplus;
  const allEquity = retainedSurplus !== 0
    ? [...equityLines, { code: "RETAINED", name: "Retained surplus (current period)", amount: retainedSurplus }]
    : equityLines;

  const assets: BalanceSheetSection = {
    label: "Assets",
    lines: assetLines,
    total: roundMoney(assetLines.reduce((sum, line) => sum + line.amount, 0)),
  };
  const liabilities: BalanceSheetSection = {
    label: "Liabilities",
    lines: liabilityLines,
    total: roundMoney(liabilityLines.reduce((sum, line) => sum + line.amount, 0)),
  };
  const equity: BalanceSheetSection = {
    label: "Equity / Funds",
    lines: allEquity,
    total: roundMoney(allEquity.reduce((sum, line) => sum + line.amount, 0)),
  };

  return {
    assets,
    liabilities,
    equity,
    totalLiabilitiesAndEquity: roundMoney(liabilities.total + equity.total),
  };
}

export function balanceSheetToCsv(rows: TrialBalanceExportRow[]) {
  const sheet = buildBalanceSheetSections(rows);
  const csvRows: Array<Array<string | number>> = [
    [sheet.assets.label, "", ""],
    ...sheet.assets.lines.map((line) => [line.code, line.name, line.amount]),
    ["", "Total Assets", sheet.assets.total],
    ["", "", ""],
    [sheet.liabilities.label, "", ""],
    ...sheet.liabilities.lines.map((line) => [line.code, line.name, line.amount]),
    ["", "Total Liabilities", sheet.liabilities.total],
    ["", "", ""],
    [sheet.equity.label, "", ""],
    ...sheet.equity.lines.map((line) => [line.code, line.name, line.amount]),
    ["", "Total Equity / Funds", sheet.equity.total],
    ["", "Total Liabilities + Equity", sheet.totalLiabilitiesAndEquity],
  ];
  return rowsToCsv(["Section / Code", "Description", "Amount"], csvRows);
}

export function ledgerEntriesToCsv(
  entries: Array<{
    postedAt: Date | string;
    accountCode: string;
    accountName: string;
    accountType: string;
    debit: number;
    credit: number;
    memo: string | null;
    sourceType: string;
    sourceId: string | null;
    description: string;
  }>,
) {
  return rowsToCsv(
    [
      "Posted At",
      "Account Code",
      "Account Name",
      "Account Type",
      "Debit",
      "Credit",
      "Memo",
      "Source Type",
      "Source Id",
      "Transaction Description",
    ],
    entries.map((entry) => [
      typeof entry.postedAt === "string" ? entry.postedAt : entry.postedAt.toISOString(),
      entry.accountCode,
      entry.accountName,
      entry.accountType,
      entry.debit,
      entry.credit,
      entry.memo || "",
      entry.sourceType,
      entry.sourceId || "",
      entry.description,
    ]),
  );
}

export function expenseRegisterToCsv(
  expenses: Array<{
    paidOn: Date | string;
    title: string;
    category: string;
    amount: number;
    paidTo: string | null;
    approvalStatus: string;
    approvedBy: string | null;
    approvedAt: Date | string | null;
    billProofFileName: string | null;
    notes: string | null;
  }>,
) {
  return rowsToCsv(
    [
      "Paid On",
      "Title",
      "Category",
      "Amount",
      "Paid To",
      "Approval Status",
      "Approved By",
      "Approved At",
      "Proof File",
      "Notes",
    ],
    expenses.map((expense) => [
      typeof expense.paidOn === "string" ? expense.paidOn : expense.paidOn.toISOString().split("T")[0],
      expense.title,
      expense.category,
      expense.amount,
      expense.paidTo || "",
      expense.approvalStatus,
      expense.approvedBy || "",
      expense.approvedAt
        ? typeof expense.approvedAt === "string"
          ? expense.approvedAt
          : expense.approvedAt.toISOString()
        : "",
      expense.billProofFileName || "",
      expense.notes || "",
    ]),
  );
}

export function incomeRegisterToCsv(
  receipts: Array<{
    paidAt: Date | string;
    flatNumber: string;
    ownerName: string;
    amount: number;
    method: string;
    reference: string | null;
    period: string;
  }>,
) {
  return rowsToCsv(
    ["Paid At", "Flat", "Owner", "Period", "Amount", "Method", "Reference"],
    receipts.map((receipt) => [
      typeof receipt.paidAt === "string" ? receipt.paidAt : receipt.paidAt.toISOString().split("T")[0],
      receipt.flatNumber,
      receipt.ownerName,
      receipt.period,
      receipt.amount,
      receipt.method,
      receipt.reference || "",
    ]),
  );
}

export function journalVouchersToCsv(
  vouchers: Array<{
    voucherNumber: string;
    voucherDate: Date | string;
    narration: string;
    status: string;
    createdBy: string | null;
  }>,
) {
  return rowsToCsv(
    ["Voucher Number", "Voucher Date", "Narration", "Status", "Created By"],
    vouchers.map((voucher) => [
      voucher.voucherNumber,
      typeof voucher.voucherDate === "string"
        ? voucher.voucherDate
        : voucher.voucherDate.toISOString().split("T")[0],
      voucher.narration,
      voucher.status,
      voucher.createdBy || "",
    ]),
  );
}

export function sanitizeExportFileName(input: string, fallback: string) {
  const cleaned = input
    .trim()
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return cleaned || fallback;
}

export function expenseProofZipPath(expense: {
  id: string;
  title: string;
  billProofFileName: string | null;
  billProofFileType: string | null;
}) {
  const baseName = sanitizeExportFileName(
    expense.billProofFileName || expense.title,
    `expense_${expense.id}`,
  );
  const ext = extensionForProofType(expense.billProofFileType);
  const withoutExt = baseName.replace(/\.[^.]+$/, "");
  return `expense_proofs/${withoutExt}_${expense.id.slice(-6)}${ext}`;
}

export function extensionForProofType(fileType: string | null | undefined) {
  switch (fileType) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}

export function decodeProofDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

export function fiscalYearWindow(fiscalYear: string) {
  const startYear = Number(fiscalYear.slice(0, 4));
  if (!Number.isFinite(startYear)) {
    throw new Error("Invalid fiscal year");
  }
  return {
    from: new Date(startYear, 3, 1),
    to: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
    label: `FY ${fiscalYear}`,
  };
}

export function currentIndianFiscalYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

export function auditorExportManifest(input: AuditorExportManifestInput): string {
  return [
    "ReManage Auditor Export Package",
    "================================",
    "",
    `Society: ${input.societyName}`,
    `Period: ${input.periodLabel}`,
    `Exported at: ${input.exportedAt}`,
    `Exported by: ${input.exportedBy}`,
    "",
    "Contents:",
    ...input.fileList.map((file) => `- ${file}`),
    "",
    "Summary:",
    `- Ledger entries: ${input.stats.ledgerEntryCount}`,
    `- Approved expenses: ${input.stats.expenseCount}`,
    `- Expense bill proofs: ${input.stats.proofCount}`,
    `- Income receipts: ${input.stats.incomeReceiptCount}`,
    "",
    "Notes:",
    "- Trial balance, balance sheet, and P&L are derived from posted ledger entries.",
    "- Expense proofs include vendor bills attached to approved expenses in this period.",
    "- Share this ZIP with your chartered accountant for annual audit.",
    "",
  ].join("\n");
}

export function auditorExportZipName(societyName: string, periodLabel: string) {
  const societySlug = sanitizeExportFileName(societyName, "society")
    .replace(/\s+/g, "_")
    .toLowerCase();
  const periodSlug = sanitizeExportFileName(periodLabel, "period")
    .replace(/\s+/g, "_")
    .toLowerCase();
  return `auditor_export_${societySlug}_${periodSlug}.zip`;
}
