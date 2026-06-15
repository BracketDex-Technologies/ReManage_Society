import { describe, expect, it } from "vitest";
import {
  auditorExportZipName,
  buildBalanceSheetSections,
  buildProfitAndLossSections,
  currentIndianFiscalYear,
  fiscalYearWindow,
  trialBalanceToCsv,
} from "@society/finance-core";

describe("auditor export contract", () => {
  const rows = [
    { code: "1010", name: "Bank", type: "ASSET", debit: 100000, credit: 20000, balance: 80000 },
    { code: "3000", name: "Maintenance Income", type: "INCOME", debit: 0, credit: 90000, balance: -90000 },
    { code: "4010", name: "Repairs", type: "EXPENSE", debit: 15000, credit: 0, balance: 15000 },
  ];

  it("packages standard CA report CSVs from trial balance", () => {
    const csv = trialBalanceToCsv(rows, { debit: 115000, credit: 110000 });
    expect(csv.split("\n").length).toBeGreaterThan(3);
    expect(buildProfitAndLossSections(rows).netSurplus).toBe(75000);
    expect(buildBalanceSheetSections(rows).assets.total).toBe(80000);
  });

  it("defaults to Indian fiscal year window", () => {
    const fy = currentIndianFiscalYear(new Date("2026-01-15"));
    expect(fy).toBe("2025-26");
    const window = fiscalYearWindow(fy);
    expect(window.from.getMonth()).toBe(3);
  });

  it("builds a stable zip filename", () => {
    expect(auditorExportZipName("Green Valley CHS", "FY 2025-26")).toContain("auditor_export_");
  });
});
