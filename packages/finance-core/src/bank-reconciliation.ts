export const DEFAULT_MATCH_THRESHOLD = 60;
export const DEFAULT_DATE_WINDOW_DAYS = 3;

export interface RawBankRow {
  rowIndex: number;
  values: Record<string, string>;
}

export interface ParsedBankStatementRow {
  rowIndex: number;
  transactionDate: Date;
  amount: number;
  reference: string;
  description: string;
}

export interface ReconciliationCandidate {
  id: string;
  sourceType: "payment" | "expense";
  transactionDate: Date;
  amount: number;
  direction: "in" | "out";
  reference: string;
  description: string;
  financialTransactionId?: string | null;
}

export interface ReconciliationMatchProposal {
  bankRowIndex: number;
  candidateId: string;
  candidateSourceType: "payment" | "expense";
  score: number;
  financialTransactionId?: string | null;
}

export interface ReconciliationMatchResult {
  proposals: ReconciliationMatchProposal[];
  unmatchedBankRows: number[];
  unusedCandidateIds: string[];
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pickValue(values: Record<string, string>, aliases: string[]) {
  for (const [key, raw] of Object.entries(values)) {
    const normalized = normalizeHeader(key);
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return String(raw ?? "").trim();
    }
  }
  return "";
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[,₹\s]/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export function parseBankDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    const date = new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseBankStatementRows(rows: RawBankRow[]): ParsedBankStatementRow[] {
  const parsed: ParsedBankStatementRow[] = [];

  for (const row of rows) {
    const dateValue =
      pickValue(row.values, ["date", "txn date", "transaction date", "value date", "posting date"]) ||
      row.values.date ||
      "";
    const description =
      pickValue(row.values, ["description", "narration", "particulars", "remarks", "details"]) ||
      "";
    const reference =
      pickValue(row.values, ["reference", "ref no", "ref", "utr", "cheque no", "chq no", "transaction id"]) ||
      "";
    const debit = parseMoney(pickValue(row.values, ["debit", "withdrawal", "dr", "paid out"]));
    const credit = parseMoney(pickValue(row.values, ["credit", "deposit", "cr", "received"]));
    const signedAmount = parseMoney(pickValue(row.values, ["amount", "transaction amount"]));

    let amount = 0;
    if (credit > 0 && debit <= 0) amount = credit;
    else if (debit > 0 && credit <= 0) amount = -debit;
    else if (signedAmount !== 0) amount = signedAmount;
    else continue;

    const transactionDate = parseBankDate(dateValue);
    if (!transactionDate || amount === 0) continue;

    parsed.push({
      rowIndex: row.rowIndex,
      transactionDate,
      amount,
      reference,
      description: description || reference || "Bank statement entry",
    });
  }

  return parsed;
}

function daysApart(a: Date, b: Date) {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / 86_400_000));
}

function referenceScore(bankReference: string, candidateReference: string) {
  const bank = bankReference.trim().toLowerCase();
  const candidate = candidateReference.trim().toLowerCase();
  if (!bank || !candidate) return 0;
  if (bank === candidate) return 20;
  if (bank.includes(candidate) || candidate.includes(bank)) return 16;
  const bankDigits = bank.replace(/\D/g, "");
  const candidateDigits = candidate.replace(/\D/g, "");
  if (bankDigits.length >= 6 && candidateDigits.includes(bankDigits)) return 14;
  if (candidateDigits.length >= 6 && bankDigits.includes(candidateDigits)) return 14;
  return 0;
}

export function scoreBankMatch(input: {
  bankRow: ParsedBankStatementRow;
  candidate: ReconciliationCandidate;
  dateWindowDays?: number;
}): number {
  const dateWindowDays = input.dateWindowDays ?? DEFAULT_DATE_WINDOW_DAYS;
  const bankDirection = input.bankRow.amount >= 0 ? "in" : "out";
  if (bankDirection !== input.candidate.direction) {
    return 0;
  }

  const bankAmount = Math.abs(input.bankRow.amount);
  const amountDiff = Math.abs(bankAmount - input.candidate.amount);
  let score = 0;

  if (amountDiff === 0) score += 50;
  else if (amountDiff <= 1) score += 42;
  else if (amountDiff <= 5) score += 28;
  else return 0;

  const dayDiff = daysApart(input.bankRow.transactionDate, input.candidate.transactionDate);
  if (dayDiff === 0) score += 30;
  else if (dayDiff === 1) score += 24;
  else if (dayDiff <= dateWindowDays) score += 16;
  else return 0;

  score += referenceScore(
    input.bankRow.reference || input.bankRow.description,
    input.candidate.reference || input.candidate.description,
  );

  return score;
}

export function proposeBankReconciliationMatches(input: {
  bankRows: ParsedBankStatementRow[];
  candidates: ReconciliationCandidate[];
  threshold?: number;
  dateWindowDays?: number;
}): ReconciliationMatchResult {
  const threshold = input.threshold ?? DEFAULT_MATCH_THRESHOLD;
  const usedCandidates = new Set<string>();
  const proposals: ReconciliationMatchProposal[] = [];
  const unmatchedBankRows: number[] = [];

  for (const bankRow of input.bankRows) {
    let best: ReconciliationMatchProposal | null = null;

    for (const candidate of input.candidates) {
      if (usedCandidates.has(candidate.id)) continue;
      const score = scoreBankMatch({
        bankRow,
        candidate,
        dateWindowDays: input.dateWindowDays,
      });
      if (score < threshold) continue;
      if (!best || score > best.score) {
        best = {
          bankRowIndex: bankRow.rowIndex,
          candidateId: candidate.id,
          candidateSourceType: candidate.sourceType,
          score,
          financialTransactionId: candidate.financialTransactionId ?? null,
        };
      }
    }

    if (best) {
      proposals.push(best);
      usedCandidates.add(best.candidateId);
    } else {
      unmatchedBankRows.push(bankRow.rowIndex);
    }
  }

  const unusedCandidateIds = input.candidates
    .map((candidate) => candidate.id)
    .filter((id) => !usedCandidates.has(id));

  return { proposals, unmatchedBankRows, unusedCandidateIds };
}

export function summarizeReconciliationSession(input: {
  totalLines: number;
  proposals: ReconciliationMatchProposal[];
}) {
  return {
    totalLines: input.totalLines,
    suggestedMatches: input.proposals.length,
    unmatchedLines: input.totalLines - input.proposals.length,
  };
}
