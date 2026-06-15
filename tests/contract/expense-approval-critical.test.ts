import { describe, expect, it } from "vitest";
import {
  EXPENSE_APPROVAL_STATUS,
  assertCanApproveExpense,
  assertCanRejectExpense,
  isExpenseCheckerRole,
  isExpenseMakerRole,
  shouldAutoApproveExpense,
} from "@society/finance-core";

describe("expense approval contract", () => {
  it("routes secretary submissions through approval and treasurer auto-posts", () => {
    expect(isExpenseMakerRole("secretary")).toBe(true);
    expect(isExpenseCheckerRole("secretary")).toBe(false);
    expect(shouldAutoApproveExpense("secretary")).toBe(false);
    expect(shouldAutoApproveExpense("treasurer")).toBe(true);
  });

  it("enforces treasurer cannot self-approve", () => {
    expect(() =>
      assertCanApproveExpense(
        { approvalStatus: EXPENSE_APPROVAL_STATUS.PENDING, submittedByUserId: "treasurer_1" },
        "treasurer_1",
      ),
    ).toThrow("You cannot approve an expense you submitted");
  });

  it("only pending expenses can be rejected", () => {
    expect(() =>
      assertCanRejectExpense({ approvalStatus: EXPENSE_APPROVAL_STATUS.APPROVED }),
    ).toThrow("Only pending expenses can be rejected");
  });
});
