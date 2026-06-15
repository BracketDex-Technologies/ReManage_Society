import { describe, expect, it } from "vitest";
import {
  EXPENSE_APPROVAL_STATUS,
  accountCodeForExpenseCategory,
  assertCanApproveExpense,
  assertCanRejectExpense,
  expenseApprovalLabel,
  isExpenseCheckerRole,
  isExpenseMakerRole,
  shouldAutoApproveExpense,
} from "./expense-approval.ts";

describe("expense approval roles", () => {
  it("identifies makers and checkers", () => {
    expect(isExpenseMakerRole("secretary")).toBe(true);
    expect(isExpenseMakerRole("chairman")).toBe(true);
    expect(isExpenseMakerRole("treasurer")).toBe(false);
    expect(isExpenseCheckerRole("treasurer")).toBe(true);
    expect(isExpenseCheckerRole("secretary")).toBe(false);
  });

  it("auto-approves treasurer submissions only", () => {
    expect(shouldAutoApproveExpense("treasurer")).toBe(true);
    expect(shouldAutoApproveExpense("secretary")).toBe(false);
  });
});

describe("accountCodeForExpenseCategory", () => {
  it("maps categories to ledger codes", () => {
    expect(accountCodeForExpenseCategory("manager_salary")).toBe("4000");
    expect(accountCodeForExpenseCategory("electricity_common_area")).toBe("4020");
    expect(accountCodeForExpenseCategory("housekeeping_salary")).toBe("4000");
    expect(accountCodeForExpenseCategory("repairs")).toBe("4010");
  });
});

describe("approval guards", () => {
  const pending = { approvalStatus: EXPENSE_APPROVAL_STATUS.PENDING, submittedByUserId: "user_a" };

  it("allows treasurer to approve someone else's submission", () => {
    expect(() => assertCanApproveExpense(pending, "user_b")).not.toThrow();
  });

  it("blocks self-approval", () => {
    expect(() => assertCanApproveExpense(pending, "user_a")).toThrow(
      "You cannot approve an expense you submitted",
    );
  });

  it("blocks approving non-pending expenses", () => {
    expect(() =>
      assertCanApproveExpense({ approvalStatus: EXPENSE_APPROVAL_STATUS.APPROVED }, "user_b"),
    ).toThrow("Only pending expenses can be approved");
  });

  it("allows rejecting pending expenses", () => {
    expect(() => assertCanRejectExpense(pending)).not.toThrow();
  });

  it("labels statuses for UI", () => {
    expect(expenseApprovalLabel(EXPENSE_APPROVAL_STATUS.PENDING)).toBe("Pending approval");
    expect(expenseApprovalLabel(EXPENSE_APPROVAL_STATUS.APPROVED)).toBe("Approved");
  });
});
