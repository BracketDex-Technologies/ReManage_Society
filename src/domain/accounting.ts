export const LEDGER_ACCOUNT_TYPES = ["ASSET", "LIABILITY", "INCOME", "EXPENSE", "EQUITY"] as const;

export const DEFAULT_LEDGER_ACCOUNTS = [
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
] as const;

export function assertBalancedLedger(entries: Array<{ debit: number; credit: number }>) {
  const debit = entries.reduce((sum, entry) => sum + entry.debit, 0);
  const credit = entries.reduce((sum, entry) => sum + entry.credit, 0);
  if (Math.round(debit * 100) !== Math.round(credit * 100)) {
    throw new Error(`Ledger transaction is not balanced: debit=${debit}, credit=${credit}`);
  }
}

export function invoiceGeneratedEntries(amount: number) {
  return [
    { accountCode: "1100", debit: amount, credit: 0, memo: "Accounts receivable" },
    { accountCode: "3000", debit: 0, credit: amount, memo: "Maintenance income" },
  ];
}

export function expensePaidEntries(amount: number, expenseAccountCode = "4010", paidFromAccountCode = "1010") {
  return [
    { accountCode: expenseAccountCode, debit: amount, credit: 0, memo: "Expense recognized" },
    { accountCode: paidFromAccountCode, debit: 0, credit: amount, memo: "Payment made" },
  ];
}
