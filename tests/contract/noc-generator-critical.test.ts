import { describe, expect, it } from "vitest";
import {
  evaluateNocEligibility,
  nocPurposeLabel,
  NOC_VALIDITY_DAYS,
} from "@society/operations-core";

describe("NOC generator contract", () => {
  it("requires zero outstanding dues before issuance", () => {
    const blocked = evaluateNocEligibility({
      bills: [
        {
          id: "b1",
          period: "2026-05",
          dueDate: new Date("2026-05-10"),
          status: "pending",
          totalAmount: 4200,
          paidAmount: 0,
        },
      ],
    });
    expect(blocked.eligible).toBe(false);
    expect(blocked.message).toMatch(/Outstanding maintenance dues/);

    const cleared = evaluateNocEligibility({ bills: [] });
    expect(cleared.eligible).toBe(true);
  });

  it("supports standard resident NOC purposes", () => {
    expect(nocPurposeLabel("sale")).toContain("sale");
    expect(nocPurposeLabel("passport")).toContain("Passport");
    expect(NOC_VALIDITY_DAYS).toBeGreaterThan(30);
  });
});
