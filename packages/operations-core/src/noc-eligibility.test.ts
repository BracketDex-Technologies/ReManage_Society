import { describe, expect, it } from "vitest";
import {
  NOC_VALIDITY_DAYS,
  assertValidNocPurpose,
  evaluateNocEligibility,
  nocPurposeLabel,
} from "./noc-eligibility.ts";

describe("evaluateNocEligibility", () => {
  it("allows NOC when no outstanding dues", () => {
    const result = evaluateNocEligibility({
      bills: [
        {
          id: "b1",
          period: "2026-03",
          dueDate: new Date("2026-03-10"),
          status: "paid",
          totalAmount: 2500,
          paidAmount: 2500,
        },
      ],
    });
    expect(result.eligible).toBe(true);
    expect(result.totalOutstanding).toBe(0);
  });

  it("blocks NOC when pending bills remain", () => {
    const result = evaluateNocEligibility({
      bills: [
        {
          id: "b1",
          period: "2026-04",
          dueDate: new Date("2026-04-10"),
          status: "pending",
          totalAmount: 3000,
          paidAmount: 0,
        },
        {
          id: "b2",
          period: "2026-03",
          dueDate: new Date("2026-03-10"),
          status: "partial",
          totalAmount: 2500,
          paidAmount: 1000,
        },
      ],
    });
    expect(result.eligible).toBe(false);
    expect(result.totalOutstanding).toBe(4500);
    expect(result.message).toContain("Outstanding maintenance dues");
  });

  it("validates purpose labels", () => {
    expect(nocPurposeLabel("sale")).toContain("sale");
    expect(assertValidNocPurpose("passport")).toBe("passport");
    expect(() => assertValidNocPurpose("invalid")).toThrow("Invalid NOC purpose");
  });

  it("uses 90-day validity constant", () => {
    expect(NOC_VALIDITY_DAYS).toBe(90);
  });
});
