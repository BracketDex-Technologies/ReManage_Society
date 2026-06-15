import { describe, expect, it } from "vitest";
import {
  DEFAULT_DUES_ENFORCEMENT_DAYS,
  assertDuesEnforcementAllows,
  evaluateDuesEnforcement,
} from "./dues-enforcement.ts";

const now = new Date("2026-06-10T12:00:00.000Z");

describe("evaluateDuesEnforcement", () => {
  it("allows booking when enforcement is disabled", () => {
    const result = evaluateDuesEnforcement({
      enabled: false,
      now,
      bills: [
        {
          id: "b1",
          period: "2026-01",
          dueDate: new Date("2026-01-10"),
          status: "pending",
          totalAmount: 2500,
          paidAmount: 0,
        },
      ],
    });

    expect(result.blocked).toBe(false);
    expect(result.enabled).toBe(false);
  });

  it("blocks when unpaid dues are older than the threshold", () => {
    const result = evaluateDuesEnforcement({
      now,
      maxOverdueDays: 60,
      bills: [
        {
          id: "b1",
          period: "2026-01",
          dueDate: new Date("2026-03-01"),
          status: "pending",
          totalAmount: 2500,
          paidAmount: 0,
        },
      ],
      feature: "amenity_booking",
    });

    expect(result.blocked).toBe(true);
    expect(result.overdueBills).toHaveLength(1);
    expect(result.totalOverdueAmount).toBe(2500);
    expect(result.message).toMatch(/clubhouse and amenity bookings/i);
  });

  it("does not block recent overdue dues inside the grace window", () => {
    const result = evaluateDuesEnforcement({
      now,
      maxOverdueDays: DEFAULT_DUES_ENFORCEMENT_DAYS,
      bills: [
        {
          id: "b1",
          period: "2026-05",
          dueDate: new Date("2026-05-15"),
          status: "pending",
          totalAmount: 2500,
          paidAmount: 0,
        },
      ],
    });

    expect(result.blocked).toBe(false);
  });

  it("ignores fully paid bills", () => {
    const result = evaluateDuesEnforcement({
      now,
      bills: [
        {
          id: "b1",
          period: "2026-01",
          dueDate: new Date("2026-01-10"),
          status: "paid",
          totalAmount: 2500,
          paidAmount: 2500,
        },
      ],
    });

    expect(result.blocked).toBe(false);
  });

  it("throws a clear error when enforcement blocks a feature", () => {
    const evaluation = evaluateDuesEnforcement({
      now,
      bills: [
        {
          id: "b1",
          period: "2026-01",
          dueDate: new Date("2026-01-10"),
          status: "partial",
          totalAmount: 2500,
          paidAmount: 500,
        },
      ],
      feature: "guest_parking",
    });

    expect(() =>
      assertDuesEnforcementAllows({ evaluation, feature: "guest_parking" }),
    ).toThrow(/guest parking requests/i);
  });
});
