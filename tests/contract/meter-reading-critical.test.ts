import { describe, expect, it } from "vitest";
import {
  DEFAULT_METER_RATES,
  buildMeterReadingPreview,
  calculateMeterCharge,
  meterTypeLabel,
} from "@society/finance-core";

describe("Meter reading import contract", () => {
  it("supports tiered utility billing for water", () => {
    expect(calculateMeterCharge(150, DEFAULT_METER_RATES.water)).toBe(1400);
    expect(meterTypeLabel("electricity_dg")).toContain("DG");
  });

  it("builds preview rows with charge amounts for valid readings", () => {
    const preview = buildMeterReadingPreview({
      meterType: "gas",
      rates: DEFAULT_METER_RATES,
      rows: [
        {
          rowIndex: 1,
          flatNumber: "101",
          previousReading: 10,
          currentReading: 14,
          meterType: "gas",
        },
      ],
    });

    expect(preview[0]?.unitsConsumed).toBe(4);
    expect(preview[0]?.chargeAmount).toBe(180);
    expect(preview[0]?.errors).toHaveLength(0);
  });
});
