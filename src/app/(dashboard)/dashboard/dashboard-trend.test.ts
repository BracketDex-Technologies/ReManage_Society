import { describe, expect, it } from "vitest";
import { shapeCollectionTrend } from "./dashboard-trend.ts";

describe("collection trend shaping", () => {
  it("scales each metric against the highest individual monthly value", () => {
    const trend = shapeCollectionTrend([
      { period: "2026-04", label: "Apr", collected: 400, pending: 50, expenses: 100, collectionRate: 89 },
      { period: "2026-05", label: "May", collected: 200, pending: 100, expenses: 50, collectionRate: 72 },
    ]);

    expect(trend.maxValue).toBe(400);
    expect(trend.items[0]).toMatchObject({ collectedHeight: 100, pendingHeight: 13, expensesHeight: 25 });
    expect(trend.items[1]).toMatchObject({ collectedHeight: 50, pendingHeight: 25, expensesHeight: 13 });
  });

  it("keeps non-zero values visible and preserves zero values", () => {
    const trend = shapeCollectionTrend([
      { period: "2026-06", label: "Jun", collected: 1, pending: 0, expenses: 0, collectionRate: 100 },
    ]);

    expect(trend.items[0]).toMatchObject({ collectedHeight: 100, pendingHeight: 0, expensesHeight: 0 });
  });
});
