import { describe, expect, it } from "vitest";
import {
  parseBankDate,
  parseBankStatementRows,
  proposeBankReconciliationMatches,
  scoreBankMatch,
} from "./bank-reconciliation.ts";

describe("bank reconciliation", () => {
  it("parses common Indian bank CSV rows", () => {
    const rows = parseBankStatementRows([
      {
        rowIndex: 0,
        values: {
          Date: "05/06/2026",
          Narration: "UPI/Flat A101 maintenance",
          "Ref No": "UTR1234567890",
          Credit: "2500",
          Debit: "",
        },
      },
      {
        rowIndex: 1,
        values: {
          Date: "06-06-2026",
          Description: "Lift AMC vendor",
          Debit: "12000",
          Credit: "",
        },
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.amount).toBe(2500);
    expect(rows[1]?.amount).toBe(-12000);
  });

  it("scores amount date and reference matches", () => {
    const bankRow = {
      rowIndex: 0,
      transactionDate: new Date("2026-06-05T00:00:00.000Z"),
      amount: 2500,
      reference: "UTR1234567890",
      description: "UPI maintenance",
    };
    const candidate = {
      id: "pay_1",
      sourceType: "payment" as const,
      transactionDate: new Date("2026-06-05T00:00:00.000Z"),
      amount: 2500,
      direction: "in" as const,
      reference: "UTR1234567890",
      description: "Flat A-101 payment",
      financialTransactionId: "ft_1",
    };

    expect(scoreBankMatch({ bankRow, candidate })).toBeGreaterThanOrEqual(90);
  });

  it("proposes one-to-one matches above threshold", () => {
    const result = proposeBankReconciliationMatches({
      bankRows: [
        {
          rowIndex: 0,
          transactionDate: new Date("2026-06-05T00:00:00.000Z"),
          amount: 2500,
          reference: "UTR123",
          description: "Maintenance",
        },
      ],
      candidates: [
        {
          id: "pay_1",
          sourceType: "payment",
          transactionDate: new Date("2026-06-05T00:00:00.000Z"),
          amount: 2500,
          direction: "in",
          reference: "UTR123",
          description: "Flat A-101",
          financialTransactionId: "ft_1",
        },
        {
          id: "exp_1",
          sourceType: "expense",
          transactionDate: new Date("2026-06-04T00:00:00.000Z"),
          amount: 9000,
          direction: "out",
          reference: "CHQ9988",
          description: "Security agency",
        },
      ],
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.candidateId).toBe("pay_1");
    expect(result.unmatchedBankRows).toEqual([]);
    expect(result.unusedCandidateIds).toEqual(["exp_1"]);
  });

  it("parses ISO and DMY dates", () => {
    expect(parseBankDate("2026-06-05")?.toISOString()).toContain("2026-06-05");
    expect(parseBankDate("05/06/2026")?.getUTCDate()).toBe(5);
  });
});
