import { describe, expect, it } from "vitest";
import {
  MOVE_WIZARD_STATUS,
  assertCanApproveMoveWizard,
  assertCanSubmitMoveWizard,
  generateGatePassCode,
  requiresTenantDocuments,
  shiftingChargeForMoveType,
} from "./move-wizard.ts";

describe("move wizard", () => {
  it("calculates shifting charge by move type", () => {
    const charges = { moveInShiftingCharge: 2000, moveOutShiftingCharge: 1500 };
    expect(shiftingChargeForMoveType("move_in", charges)).toBe(2000);
    expect(shiftingChargeForMoveType("move_out", charges)).toBe(1500);
  });

  it("requires tenant documents on move-in", () => {
    expect(requiresTenantDocuments("move_in", "tenant")).toBe(true);
    expect(requiresTenantDocuments("move_in", "owner")).toBe(false);
  });

  it("blocks submit until payment and documents are ready", () => {
    expect(() =>
      assertCanSubmitMoveWizard({
        workflowStatus: MOVE_WIZARD_STATUS.DRAFT,
        type: "move_in",
        residentType: "tenant",
        shiftingChargeAmount: 2000,
        shiftingChargePaid: false,
        scheduledMoveDate: new Date(),
        policeVerificationDataUrl: "data:application/pdf;base64,abc",
        leaseAgreementDataUrl: "data:application/pdf;base64,def",
      }),
    ).toThrow("Pay shifting charges");

    expect(() =>
      assertCanSubmitMoveWizard({
        workflowStatus: MOVE_WIZARD_STATUS.DRAFT,
        type: "move_in",
        residentType: "owner",
        shiftingChargeAmount: 0,
        shiftingChargePaid: true,
        scheduledMoveDate: new Date(),
      }),
    ).not.toThrow();
  });

  it("approves only pending requests", () => {
    expect(() =>
      assertCanApproveMoveWizard({
        workflowStatus: MOVE_WIZARD_STATUS.PENDING_APPROVAL,
        type: "move_in",
        residentType: "tenant",
        shiftingChargeAmount: 0,
        shiftingChargePaid: true,
      }),
    ).not.toThrow();
  });

  it("generates six-digit gate pass codes", () => {
    expect(generateGatePassCode(() => 0.123456)).toMatch(/^\d{6}$/);
  });
});
