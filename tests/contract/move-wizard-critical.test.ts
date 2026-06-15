import { describe, expect, it } from "vitest";
import {
  MOVE_WIZARD_STATUS,
  assertCanSubmitMoveWizard,
  generateGatePassCode,
  shiftingChargeForMoveType,
} from "@society/society-core";

describe("move wizard contract", () => {
  it("uses society shifting charges by move type", () => {
    const charges = { moveInShiftingCharge: 2500, moveOutShiftingCharge: 1800 };
    expect(shiftingChargeForMoveType("move_in", charges)).toBe(2500);
    expect(shiftingChargeForMoveType("move_out", charges)).toBe(1800);
  });

  it("blocks submit until shifting fee is paid when required", () => {
    expect(() =>
      assertCanSubmitMoveWizard({
        workflowStatus: MOVE_WIZARD_STATUS.DRAFT,
        type: "move_out",
        residentType: "owner",
        shiftingChargeAmount: 1500,
        shiftingChargePaid: false,
        scheduledMoveDate: new Date(),
      }),
    ).toThrow("Pay shifting charges");
  });

  it("issues six-digit gate pass codes", () => {
    expect(generateGatePassCode(() => 0.42)).toHaveLength(6);
  });
});
