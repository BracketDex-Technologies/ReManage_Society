import { describe, expect, it } from "vitest";
import { evaluateDuesEnforcement } from "@society/operations-core";

describe("dues enforcement contract", () => {
  it("blocks amenity booking when dues exceed configured days", () => {
    const evaluation = evaluateDuesEnforcement({
      now: new Date("2026-06-10T00:00:00.000Z"),
      maxOverdueDays: 60,
      feature: "amenity_booking",
      bills: [
        {
          id: "bill_1",
          period: "2026-01",
          dueDate: new Date("2026-01-05T00:00:00.000Z"),
          status: "pending",
          totalAmount: 3200,
          paidAmount: 0,
        },
      ],
    });

    expect(evaluation.blocked).toBe(true);
    expect(evaluation.blockedFeatures).toContain("guest_parking");
    expect(evaluation.message).toMatch(/clubhouse and amenity bookings/i);
  });
});
