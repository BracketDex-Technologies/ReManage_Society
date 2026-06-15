import { describe, expect, it } from "vitest";
import { proposeBankReconciliationMatches } from "@society/finance-core";

describe("bank reconciliation contract", () => {
  it("matches outgoing bank debits to expense records", () => {
    const result = proposeBankReconciliationMatches({
      bankRows: [
        {
          rowIndex: 0,
          transactionDate: new Date("2026-06-04T00:00:00.000Z"),
          amount: -9000,
          reference: "CHQ998877",
          description: "Security agency payout",
        },
      ],
      candidates: [
        {
          id: "exp_1",
          sourceType: "expense",
          transactionDate: new Date("2026-06-04T00:00:00.000Z"),
          amount: 9000,
          direction: "out",
          reference: "CHQ998877",
          description: "Security agency June",
        },
      ],
    });

    expect(result.proposals[0]?.candidateId).toBe("exp_1");
  });
});
