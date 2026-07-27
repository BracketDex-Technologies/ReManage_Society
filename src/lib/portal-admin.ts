export type PortalBillInput = {
  amount: number;
  lateFee: number;
  gstAmount: number;
  totalAmount: number | null;
  paidAmount: number | null;
};

export type PortalExpenseInput = {
  amount: number;
};

export type SocietyPortalStatsInput = {
  openingBalance: number;
  bills: PortalBillInput[];
  expenses: PortalExpenseInput[];
};

export type SocietyPortalStats = {
  totalCollected: number;
  pendingAmount: number;
  totalExpenses: number;
  balance: number;
};

export type SocietyDeleteState = {
  deletedAt: Date | string | null;
};

export type SocietyAccessState = {
  accessDisabledAt: Date | string | null;
};

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function billTotal(bill: PortalBillInput) {
  return bill.totalAmount ?? bill.amount + bill.lateFee + bill.gstAmount;
}

export function generateTemporaryPassword(length = 12) {
  let password = "";
  const cryptoObj = globalThis.crypto;

  if (cryptoObj?.getRandomValues) {
    const values = new Uint32Array(length);
    cryptoObj.getRandomValues(values);
    for (const value of values) {
      password += PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length];
    }
    return password;
  }

  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)];
  }
  return password;
}

export function calculateSocietyPortalStats(input: SocietyPortalStatsInput): SocietyPortalStats {
  const totalCollected = input.bills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0);
  const pendingAmount = input.bills.reduce((sum, bill) => {
    return sum + Math.max(0, billTotal(bill) - (bill.paidAmount || 0));
  }, 0);
  const totalExpenses = input.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    totalCollected: roundMoney(totalCollected),
    pendingAmount: roundMoney(pendingAmount),
    totalExpenses: roundMoney(totalExpenses),
    balance: roundMoney(input.openingBalance + totalCollected - totalExpenses),
  };
}

export function isDeletedSociety(society: SocietyDeleteState) {
  return Boolean(society.deletedAt);
}

export function isSocietyAccessDisabled(society: SocietyAccessState) {
  return Boolean(society.accessDisabledAt);
}
