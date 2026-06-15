export const EXPENSE_APPROVAL_STATUS = {
  PENDING: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ExpenseApprovalStatus =
  (typeof EXPENSE_APPROVAL_STATUS)[keyof typeof EXPENSE_APPROVAL_STATUS];

export const EXPENSE_MAKER_ROLES = ["chairman", "secretary"] as const;
export const EXPENSE_CHECKER_ROLES = ["treasurer"] as const;

export function isExpenseMakerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (EXPENSE_MAKER_ROLES as readonly string[]).includes(role);
}

export function isExpenseCheckerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (EXPENSE_CHECKER_ROLES as readonly string[]).includes(role);
}

/** Treasurer entries post immediately; secretary/chairman submit for approval. */
export function shouldAutoApproveExpense(role: string | null | undefined): boolean {
  return isExpenseCheckerRole(role);
}

export function accountCodeForExpenseCategory(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes("salary")) return "4000";
  if (normalized.includes("utilit") || normalized.includes("electricity") || normalized.includes("water")) {
    return "4020";
  }
  if (normalized.includes("clean") || normalized.includes("housekeep")) return "4030";
  return "4010";
}

export interface ExpenseApprovalRecord {
  approvalStatus: string;
  submittedByUserId?: string | null;
}

export function assertCanApproveExpense(
  expense: ExpenseApprovalRecord,
  approverUserId: string,
): void {
  if (expense.approvalStatus !== EXPENSE_APPROVAL_STATUS.PENDING) {
    throw new Error("Only pending expenses can be approved");
  }
  if (expense.submittedByUserId && expense.submittedByUserId === approverUserId) {
    throw new Error("You cannot approve an expense you submitted");
  }
}

export function assertCanRejectExpense(expense: ExpenseApprovalRecord): void {
  if (expense.approvalStatus !== EXPENSE_APPROVAL_STATUS.PENDING) {
    throw new Error("Only pending expenses can be rejected");
  }
}

export function expenseApprovalLabel(status: string): string {
  switch (status) {
    case EXPENSE_APPROVAL_STATUS.PENDING:
      return "Pending approval";
    case EXPENSE_APPROVAL_STATUS.REJECTED:
      return "Rejected";
    case EXPENSE_APPROVAL_STATUS.APPROVED:
    default:
      return "Approved";
  }
}
