export const NOC_PURPOSES = ["sale", "rental", "passport", "general"] as const;

export type NocPurpose = (typeof NOC_PURPOSES)[number];

export const NOC_VALIDITY_DAYS = 90;

export interface NocBillSnapshot {
  id: string;
  period: string;
  dueDate: Date;
  status: string;
  totalAmount: number;
  paidAmount: number;
  description?: string | null;
}

export interface NocEligibilityResult {
  eligible: boolean;
  totalOutstanding: number;
  pendingBills: Array<{
    id: string;
    period: string;
    remainingAmount: number;
    dueDate: Date;
  }>;
  message: string | null;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function billRemaining(bill: NocBillSnapshot) {
  return roundMoney(Math.max(0, bill.totalAmount - (bill.paidAmount ?? 0)));
}

export function nocPurposeLabel(purpose: string): string {
  switch (purpose) {
    case "sale":
      return "Flat sale / transfer";
    case "rental":
      return "Renting / leasing";
    case "passport":
      return "Passport / visa";
    case "general":
    default:
      return "General society clearance";
  }
}

export function assertValidNocPurpose(purpose: string): NocPurpose {
  if (!(NOC_PURPOSES as readonly string[]).includes(purpose)) {
    throw new Error("Invalid NOC purpose");
  }
  return purpose as NocPurpose;
}

export function evaluateNocEligibility(input: { bills: NocBillSnapshot[] }): NocEligibilityResult {
  const pendingBills = input.bills
    .map((bill) => ({
      id: bill.id,
      period: bill.period,
      dueDate: bill.dueDate,
      remainingAmount: billRemaining(bill),
    }))
    .filter((bill) => bill.remainingAmount > 0);

  const totalOutstanding = roundMoney(
    pendingBills.reduce((sum, bill) => sum + bill.remainingAmount, 0),
  );

  if (totalOutstanding <= 0) {
    return {
      eligible: true,
      totalOutstanding: 0,
      pendingBills: [],
      message: null,
    };
  }

  const billSummary =
    pendingBills.length === 1
      ? `${pendingBills[0].period} (₹${pendingBills[0].remainingAmount.toLocaleString("en-IN")})`
      : `${pendingBills.length} bills totalling ₹${totalOutstanding.toLocaleString("en-IN")}`;

  return {
    eligible: false,
    totalOutstanding,
    pendingBills,
    message: `Outstanding maintenance dues: ${billSummary}. Clear all dues from My Bills before requesting an NOC.`,
  };
}

export function buildNocVerificationCode(hash: string) {
  return hash.slice(0, 12).toUpperCase();
}
