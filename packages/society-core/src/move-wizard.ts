export const MOVE_WIZARD_STATUS = {
  CHECKLIST: "checklist",
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type MoveWizardStatus = (typeof MOVE_WIZARD_STATUS)[keyof typeof MOVE_WIZARD_STATUS];

export const MOVE_WIZARD_TYPES = ["move_in", "move_out"] as const;
export type MoveWizardType = (typeof MOVE_WIZARD_TYPES)[number];

export const MOVE_RESIDENT_TYPES = ["owner", "tenant", "family"] as const;

export interface MoveWizardRecord {
  workflowStatus: string;
  type: string;
  residentType: string;
  shiftingChargeAmount: number;
  shiftingChargePaid: boolean;
  policeVerificationDataUrl?: string | null;
  leaseAgreementDataUrl?: string | null;
  scheduledMoveDate?: Date | string | null;
}

export function shiftingChargeForMoveType(
  type: string,
  charges: { moveInShiftingCharge: number; moveOutShiftingCharge: number },
): number {
  return type === "move_out" ? charges.moveOutShiftingCharge : charges.moveInShiftingCharge;
}

export function requiresTenantDocuments(type: string, residentType: string): boolean {
  return type === "move_in" && residentType === "tenant";
}

export function assertCanSubmitMoveWizard(record: MoveWizardRecord): void {
  if (record.workflowStatus !== MOVE_WIZARD_STATUS.DRAFT) {
    throw new Error("Only draft requests can be submitted");
  }
  if (!record.scheduledMoveDate) {
    throw new Error("Scheduled move date is required");
  }
  if (requiresTenantDocuments(record.type, record.residentType)) {
    if (!record.policeVerificationDataUrl) {
      throw new Error("Police verification document is required for tenant move-in");
    }
    if (!record.leaseAgreementDataUrl) {
      throw new Error("Lease agreement is required for tenant move-in");
    }
  }
  if (record.shiftingChargeAmount > 0 && !record.shiftingChargePaid) {
    throw new Error("Pay shifting charges before submitting for approval");
  }
}

export function assertCanApproveMoveWizard(record: MoveWizardRecord): void {
  if (record.workflowStatus !== MOVE_WIZARD_STATUS.PENDING_APPROVAL) {
    throw new Error("Only pending requests can be approved");
  }
}

export function assertCanRejectMoveWizard(record: MoveWizardRecord): void {
  if (record.workflowStatus !== MOVE_WIZARD_STATUS.PENDING_APPROVAL) {
    throw new Error("Only pending requests can be rejected");
  }
}

export function isCommitteeMoveApprover(role: string): boolean {
  return ["chairman", "secretary"].includes(role);
}

export function generateGatePassCode(random: () => number = Math.random): string {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("Gate pass random source must return a value in [0, 1).");
  }
  return String(Math.floor(100000 + value * 900000));
}

export function moveWizardStatusLabel(status: string): string {
  switch (status) {
    case MOVE_WIZARD_STATUS.DRAFT:
      return "Draft";
    case MOVE_WIZARD_STATUS.PENDING_APPROVAL:
      return "Pending approval";
    case MOVE_WIZARD_STATUS.APPROVED:
      return "Approved — gate pass issued";
    case MOVE_WIZARD_STATUS.REJECTED:
      return "Rejected";
    case MOVE_WIZARD_STATUS.CHECKLIST:
    default:
      return "Checklist workflow";
  }
}

export function buildMoveWizardChecklist(type: MoveWizardType) {
  if (type === "move_in") {
    return [
      { item: "Society NOC obtained", status: "pending" },
      { item: "Police verification submitted", status: "pending" },
      { item: "Shifting charges paid", status: "pending" },
      { item: "Manager approved gate pass", status: "pending" },
      { item: "Parking slot assigned", status: "pending" },
      { item: "Society app access created", status: "pending" },
    ];
  }
  return [
    { item: "All dues cleared", status: "pending" },
    { item: "Shifting charges paid", status: "pending" },
    { item: "Manager approved gate pass", status: "pending" },
    { item: "Keys returned", status: "pending" },
    { item: "Parking slot released", status: "pending" },
    { item: "App access revoked", status: "pending" },
  ];
}

export function markChecklistItemCompleted(
  checklistJson: string,
  itemKeyword: string,
  completedBy: string,
): string {
  const checklist = JSON.parse(checklistJson || "[]") as Array<{
    item: string;
    status: string;
    completedBy?: string;
    completedAt?: string;
  }>;
  const now = new Date().toISOString();
  for (const entry of checklist) {
    if (entry.item.toLowerCase().includes(itemKeyword.toLowerCase())) {
      entry.status = "completed";
      entry.completedBy = completedBy;
      entry.completedAt = now;
    }
  }
  return JSON.stringify(checklist);
}
