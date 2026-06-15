export type FinanceAccountType = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
export type JournalSide = "DEBIT" | "CREDIT";

export interface FinanceAccountDefinition {
  code: string;
  name: string;
  type: FinanceAccountType;
}

export interface JournalPostingLineInput {
  accountCode: string;
  side: JournalSide;
  amount: number;
  memo?: string;
}

export interface JournalPostingPlanInput {
  societyId: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  narration: string;
  lines: readonly JournalPostingLineInput[];
}

export interface JournalPostingPlan {
  societyId: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  lines: readonly JournalPostingLineInput[];
}

export interface RazorpayWebhookIdentity {
  eventId: string;
  paymentId: string;
}

export const DEFAULT_FINANCE_ACCOUNTS: readonly FinanceAccountDefinition[] = [
  { code: "1000", name: "Cash", type: "ASSET" },
  { code: "1010", name: "Bank", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1200", name: "Reserve Funds", type: "ASSET" },
  { code: "2000", name: "Vendor Payables", type: "LIABILITY" },
  { code: "2100", name: "Deposits", type: "LIABILITY" },
  { code: "3000", name: "Maintenance Income", type: "INCOME" },
  { code: "3010", name: "Parking Income", type: "INCOME" },
  { code: "3020", name: "Amenity Income", type: "INCOME" },
  { code: "4000", name: "Salaries", type: "EXPENSE" },
  { code: "4010", name: "Repairs", type: "EXPENSE" },
  { code: "4020", name: "Utilities", type: "EXPENSE" },
  { code: "4030", name: "Cleaning", type: "EXPENSE" },
  { code: "5000", name: "Opening Balance Equity", type: "EQUITY" },
];

export function createJournalPostingPlan(input: JournalPostingPlanInput): JournalPostingPlan {
  if (!input.idempotencyKey.trim()) {
    throw new Error("Idempotency key is required for financial postings.");
  }

  if (input.lines.length < 2) {
    throw new Error("A financial posting needs at least two ledger lines.");
  }

  const lines = input.lines.map(normalizeJournalLine);
  const totalDebit = roundMoney(
    lines.reduce((sum, line) => sum + (line.side === "DEBIT" ? line.amount : 0), 0),
  );
  const totalCredit = roundMoney(
    lines.reduce((sum, line) => sum + (line.side === "CREDIT" ? line.amount : 0), 0),
  );

  if (totalDebit !== totalCredit) {
    throw new Error(`Ledger posting is not balanced: debit=${totalDebit}, credit=${totalCredit}`);
  }

  return {
    societyId: input.societyId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey.trim(),
    narration: input.narration.trim(),
    totalDebit,
    totalCredit,
    lines,
  };
}

export function invoicePostingLines(
  amount: number,
  incomeAccountCode = "3000",
): JournalPostingLineInput[] {
  const normalizedAmount = normalizeMoney(amount);

  return [
    {
      accountCode: "1100",
      side: "DEBIT",
      amount: normalizedAmount,
      memo: "Accounts receivable",
    },
    {
      accountCode: incomeAccountCode,
      side: "CREDIT",
      amount: normalizedAmount,
      memo: "Maintenance income",
    },
  ];
}

export function paymentPostingLines(
  amount: number,
  bankAccountCode = "1010",
): JournalPostingLineInput[] {
  const normalizedAmount = normalizeMoney(amount);

  return [
    {
      accountCode: bankAccountCode,
      side: "DEBIT",
      amount: normalizedAmount,
      memo: "Payment received",
    },
    {
      accountCode: "1100",
      side: "CREDIT",
      amount: normalizedAmount,
      memo: "Accounts receivable settled",
    },
  ];
}

export function expensePostingLines(
  amount: number,
  expenseAccountCode = "4010",
  paidFromAccountCode = "1010",
): JournalPostingLineInput[] {
  const normalizedAmount = normalizeMoney(amount);

  return [
    {
      accountCode: expenseAccountCode,
      side: "DEBIT",
      amount: normalizedAmount,
      memo: "Expense recognized",
    },
    {
      accountCode: paidFromAccountCode,
      side: "CREDIT",
      amount: normalizedAmount,
      memo: "Payment made",
    },
  ];
}

export function payrollPostingLines(
  amount: number,
  salaryAccountCode = "4000",
  paidFromAccountCode = "1010",
): JournalPostingLineInput[] {
  const normalizedAmount = normalizeMoney(amount);

  return [
    {
      accountCode: salaryAccountCode,
      side: "DEBIT",
      amount: normalizedAmount,
      memo: "Payroll expense recognized",
    },
    {
      accountCode: paidFromAccountCode,
      side: "CREDIT",
      amount: normalizedAmount,
      memo: "Payroll payment made",
    },
  ];
}

export function buildReceiptNumber(prefix: string, year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("Receipt sequence must be greater than zero.");
  }

  const normalizedPrefix = prefix.trim().toUpperCase();
  if (!normalizedPrefix) {
    throw new Error("Receipt prefix is required.");
  }

  return `RCPT-${normalizedPrefix}-${year}-${String(sequence).padStart(5, "0")}`;
}

export function razorpayWebhookIdempotencyKey(identity: RazorpayWebhookIdentity): string {
  const eventId = identity.eventId.trim();
  const paymentId = identity.paymentId.trim();

  if (!eventId || !paymentId) {
    throw new Error("Razorpay event and payment IDs are required.");
  }

  return `razorpay:${eventId}:${paymentId}`;
}

function normalizeJournalLine(line: JournalPostingLineInput): JournalPostingLineInput {
  const accountCode = line.accountCode.trim();

  if (!accountCode) {
    throw new Error("Ledger line account code is required.");
  }

  const amount = normalizeMoney(line.amount);

  return {
    accountCode,
    side: line.side,
    amount,
    ...(line.memo?.trim() ? { memo: line.memo.trim() } : {}),
  };
}

function normalizeMoney(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Ledger line amount must be greater than zero.");
  }

  return roundMoney(amount);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export {
  DEFAULT_DATE_WINDOW_DAYS,
  DEFAULT_MATCH_THRESHOLD,
  parseBankDate,
  parseBankStatementRows,
  proposeBankReconciliationMatches,
  scoreBankMatch,
  summarizeReconciliationSession,
  type ParsedBankStatementRow,
  type RawBankRow,
  type ReconciliationCandidate,
  type ReconciliationMatchProposal,
  type ReconciliationMatchResult,
} from "./bank-reconciliation.ts";

export {
  DEFAULT_METER_RATES,
  SUPPORTED_METER_TYPES,
  appendUtilityDescriptionLine,
  buildMeterReadingPreview,
  buildUtilityDescriptionLine,
  calculateMeterCharge,
  calculateMeterUsage,
  indexFlatsByNormalizedNumber,
  matchFlatNumber,
  mergeSocietyMeterRates,
  meterTypeLabel,
  normalizeFlatNumber,
  normalizeMeterType,
  parseMeterReadingRows,
  stripUtilityDescriptionLine,
  summarizeMeterImport,
  utilityDescriptionTag,
  type FlatLookupEntry,
  type MeterRateConfig,
  type MeterRateTier,
  type MeterReadingPreviewRow,
  type MeterType,
  type ParsedMeterReadingRow,
  type RawMeterRow,
  type SocietyMeterRates,
} from "./meter-reading.ts";

export {
  EXPENSE_APPROVAL_STATUS,
  EXPENSE_CHECKER_ROLES,
  EXPENSE_MAKER_ROLES,
  accountCodeForExpenseCategory,
  assertCanApproveExpense,
  assertCanRejectExpense,
  expenseApprovalLabel,
  isExpenseCheckerRole,
  isExpenseMakerRole,
  shouldAutoApproveExpense,
  type ExpenseApprovalStatus,
} from "./expense-approval.ts";

export {
  auditorExportManifest,
  auditorExportZipName,
  balanceSheetToCsv,
  buildBalanceSheetSections,
  buildProfitAndLossSections,
  csvEscape,
  currentIndianFiscalYear,
  decodeProofDataUrl,
  expenseProofZipPath,
  expenseRegisterToCsv,
  extensionForProofType,
  fiscalYearWindow,
  incomeRegisterToCsv,
  journalVouchersToCsv,
  ledgerEntriesToCsv,
  profitAndLossToCsv,
  rowsToCsv,
  sanitizeExportFileName,
  trialBalanceToCsv,
  type AuditorExportManifestInput,
  type BalanceSheetSection,
  type TrialBalanceExportRow,
} from "./auditor-export.ts";
