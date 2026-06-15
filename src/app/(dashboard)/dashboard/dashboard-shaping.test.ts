import { describe, expect, it } from "vitest";
import { shapeGuardDashboardMetrics, shapeTreasurerSnapshot } from "./dashboard-shaping.ts";

describe("dashboard shaping", () => {
  it("shapes guard metrics with defaults", () => {
    expect(shapeGuardDashboardMetrics(null)).toEqual({
      visitorsToday: 0,
      openComplaints: 0,
      activePolls: 0,
    });
  });

  it("computes treasurer collection rate", () => {
    expect(
      shapeTreasurerSnapshot({
        totalCollected: 70,
        pendingAmount: 30,
        totalExpenses: 10,
        totalMembers: 1,
        paidCount: 1,
        partialCount: 0,
        pendingCount: 1,
        totalFlats: 1,
        period: "Jun 2026",
        fundBalance: 100,
        openComplaints: 0,
        visitorsToday: 2,
        activePolls: 0,
      }),
    ).toMatchObject({
      collectionRate: 70,
      fundBalance: 100,
    });
  });
});
