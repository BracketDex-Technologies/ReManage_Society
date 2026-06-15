import { describe, expect, it } from "vitest";
import {
  auditorExportManifest,
  balanceSheetToCsv,
  buildBalanceSheetSections,
  buildProfitAndLossSections,
  csvEscape,
  currentIndianFiscalYear,
  decodeProofDataUrl,
  expenseProofZipPath,
  fiscalYearWindow,
  profitAndLossToCsv,
  trialBalanceToCsv,
  type TrialBalanceExportRow,
} from "./auditor-export.ts";

const sampleRows: TrialBalanceExportRow[] = [
  { code: "1010", name: "Bank", type: "ASSET", debit: 50000, credit: 10000, balance: 40000 },
  { code: "1100", name: "Accounts Receivable", type: "ASSET", debit: 5000, credit: 0, balance: 5000 },
  { code: "2000", name: "Vendor Payables", type: "LIABILITY", debit: 0, credit: 3000, balance: -3000 },
  { code: "3000", name: "Maintenance Income", type: "INCOME", debit: 0, credit: 42000, balance: -42000 },
  { code: "4010", name: "Repairs", type: "EXPENSE", debit: 8000, credit: 0, balance: 8000 },
];

describe("csvEscape", () => {
  it("quotes values with commas", () => {
    expect(csvEscape('Lift, AMC')).toBe('"Lift, AMC"');
  });
});

describe("trialBalanceToCsv", () => {
  it("includes totals row", () => {
    const csv = trialBalanceToCsv(sampleRows, { debit: 63000, credit: 55000 });
    expect(csv).toContain("Account Code");
    expect(csv).toContain("1010,Bank,ASSET");
    expect(csv).toContain("TOTAL");
  });
});

describe("buildProfitAndLossSections", () => {
  it("computes surplus from income and expense accounts", () => {
    const pnl = buildProfitAndLossSections(sampleRows);
    expect(pnl.totalIncome).toBe(42000);
    expect(pnl.totalExpense).toBe(8000);
    expect(pnl.netSurplus).toBe(34000);
  });
});

describe("buildBalanceSheetSections", () => {
  it("rolls retained surplus into equity", () => {
    const sheet = buildBalanceSheetSections(sampleRows);
    expect(sheet.assets.total).toBe(45000);
    expect(sheet.liabilities.total).toBe(3000);
    expect(sheet.equity.lines.some((line) => line.code === "RETAINED")).toBe(true);
    expect(sheet.totalLiabilitiesAndEquity).toBe(sheet.liabilities.total + sheet.equity.total);
  });

  it("exports readable CSV sections", () => {
    expect(profitAndLossToCsv(sampleRows)).toContain("Net Surplus / (Deficit)");
    expect(balanceSheetToCsv(sampleRows)).toContain("Total Assets");
  });
});

describe("proof helpers", () => {
  it("builds stable proof zip paths", () => {
    expect(
      expenseProofZipPath({
        id: "expense_abc123",
        title: "Lift AMC",
        billProofFileName: "amc-april.pdf",
        billProofFileType: "application/pdf",
      }),
    ).toBe("expense_proofs/amc-april_abc123.pdf");
  });

  it("decodes base64 data urls", () => {
    const buffer = decodeProofDataUrl("data:text/plain;base64,aGVsbG8=");
    expect(buffer?.toString("utf8")).toBe("hello");
  });
});

describe("fiscal helpers", () => {
  it("resolves Indian fiscal year window", () => {
    const window = fiscalYearWindow("2025-26");
    expect(window.from.getFullYear()).toBe(2025);
    expect(window.to.getFullYear()).toBe(2026);
  });

  it("detects current fiscal year", () => {
    expect(currentIndianFiscalYear(new Date("2025-08-01"))).toBe("2025-26");
    expect(currentIndianFiscalYear(new Date("2025-02-01"))).toBe("2024-25");
  });
});

describe("auditorExportManifest", () => {
  it("lists package contents", () => {
    const manifest = auditorExportManifest({
      societyName: "Green Valley CHS",
      periodLabel: "FY 2025-26",
      exportedAt: "2025-06-10",
      exportedBy: "Treasurer",
      fileList: ["trial_balance.csv", "expense_proofs/"],
      stats: { ledgerEntryCount: 10, expenseCount: 2, proofCount: 1, incomeReceiptCount: 5 },
    });
    expect(manifest).toContain("Green Valley CHS");
    expect(manifest).toContain("trial_balance.csv");
  });
});
