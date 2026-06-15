import { describe, expect, it } from "vitest";
import {
  DEFAULT_METER_RATES,
  appendUtilityDescriptionLine,
  buildMeterReadingPreview,
  calculateMeterCharge,
  calculateMeterUsage,
  indexFlatsByNormalizedNumber,
  matchFlatNumber,
  parseMeterReadingRows,
  stripUtilityDescriptionLine,
  summarizeMeterImport,
} from "./meter-reading.ts";

describe("parseMeterReadingRows", () => {
  it("parses flexible spreadsheet columns", () => {
    const rows = parseMeterReadingRows(
      [
        {
          rowIndex: 1,
          values: {
            "Flat No": "A-101",
            "Previous Reading": "1200",
            "Current Reading": "1285",
          },
        },
      ],
      "water",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      flatNumber: "A-101",
      previousReading: 1200,
      currentReading: 1285,
      meterType: "water",
    });
  });
});

describe("calculateMeterUsage", () => {
  it("computes units consumed", () => {
    expect(calculateMeterUsage(1200, 1285)).toBe(85);
  });

  it("rejects reversed readings", () => {
    expect(() => calculateMeterUsage(200, 150)).toThrow(/cannot be less/);
  });
});

describe("calculateMeterCharge", () => {
  it("applies tiered water rates", () => {
    const low = calculateMeterCharge(80, DEFAULT_METER_RATES.water);
    expect(low).toBe(640);

    const high = calculateMeterCharge(150, DEFAULT_METER_RATES.water);
    expect(high).toBe(1400);
  });

  it("uses flat per-unit rate when no tiers configured", () => {
    expect(calculateMeterCharge(10, DEFAULT_METER_RATES.electricity_dg)).toBe(180);
  });
});

describe("utility description helpers", () => {
  it("replaces prior utility line for the same meter type", () => {
    const first = appendUtilityDescriptionLine(
      "Monthly Maintenance",
      "water",
      "[UTILITY:water] Water: 80 units @ ₹8 = ₹640",
    );
    const next = appendUtilityDescriptionLine(
      first,
      "water",
      "[UTILITY:water] Water: 85 units @ ₹8 = ₹680",
    );

    expect(next).toContain("₹680");
    expect(next.match(/Water:/g)?.length).toBe(1);
    expect(stripUtilityDescriptionLine(next, "water")).toBe("Monthly Maintenance");
  });
});

describe("buildMeterReadingPreview", () => {
  it("summarizes valid and invalid rows", () => {
    const preview = buildMeterReadingPreview({
      meterType: "electricity_grid",
      rates: DEFAULT_METER_RATES,
      rows: [
        {
          rowIndex: 1,
          flatNumber: "B-202",
          previousReading: 500,
          currentReading: 560,
          meterType: "electricity_grid",
        },
        {
          rowIndex: 2,
          flatNumber: "C-303",
          previousReading: 900,
          currentReading: 850,
          meterType: "electricity_grid",
        },
      ],
    });

    expect(preview[0]?.chargeAmount).toBe(390);
    expect(preview[1]?.errors[0]).toMatch(/cannot be less/);

    const summary = summarizeMeterImport(preview);
    expect(summary.validRows).toBe(1);
    expect(summary.totalCharge).toBe(390);
  });
});

describe("flat matching", () => {
  it("matches flat numbers case-insensitively", () => {
    const index = indexFlatsByNormalizedNumber([
      { id: "flat_1", flatNumber: "A-101" },
    ]);
    expect(matchFlatNumber("a101", index)?.id).toBe("flat_1");
  });
});
