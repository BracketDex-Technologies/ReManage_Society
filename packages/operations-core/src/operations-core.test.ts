import { describe, expect, it } from "vitest";
import {
  applyPackageTransition,
  applyVisitorTransition,
  attendanceDedupeKey,
  buildGuardActionEnvelope,
  computeAttendanceDurationMinutes,
  generatePickupOtp,
  generateStaffEntryCode,
  generateVisitorPasscode,
  applyWaitlistTransition,
  assertCancellationAllowed,
  computeCoverageStatus,
  computeNextMaintenance,
  computeSosEscalation,
  isMaintenanceDue,
  matchBlacklist,
  normalizeAssetCondition,
  normalizeIncidentSeverity,
  normalizeIncidentType,
  normalizeVendorCategory,
  sosDedupeKey,
  computeBookingAmount,
  computeBookingHours,
  evaluateBookingRequest,
  normalizeAttendanceMethod,
  normalizeParkingAssignmentType,
  normalizeParkingSlotType,
  normalizeStaffCategory,
  assertSlotAssignable,
  parseTimeToMinutes,
  summarizeParkingCapacity,
  packageIntakeDedupeKey,
  patrolScanDedupeKey,
  planExpectedVisitor,
  planPackageIntake,
  planVisitorLog,
  verifyPackagePickup,
  visitorLogDedupeKey,
  PACKAGE_TERMINAL_STATUSES,
  VISITOR_TERMINAL_STATUSES,
} from "./index.ts";

describe("visitor lifecycle state machine", () => {
  it("logs a walk-in visitor as pending_approval", () => {
    const plan = planVisitorLog({
      societyId: "society_a",
      flatNumber: "A-101",
      visitorName: "Ravi Kumar",
      phone: "9999999999",
      purpose: "delivery",
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
    });

    expect(plan).toMatchObject({
      status: "pending_approval",
      isPreApproved: false,
      requiresResidentApproval: true,
    });
  });

  it("logs a pre-approved gate arrival straight to inside", () => {
    const plan = planVisitorLog({
      societyId: "society_a",
      flatNumber: "A-101",
      visitorName: "Ravi Kumar",
      purpose: "guest",
      isPreApproved: true,
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
    });

    expect(plan).toMatchObject({
      status: "inside",
      isPreApproved: true,
      requiresResidentApproval: false,
    });
  });

  it("plans a resident pre-registered visitor as expected", () => {
    const plan = planExpectedVisitor({
      societyId: "society_a",
      flatNumber: "A-101",
      visitorName: "Guest",
      purpose: "party",
      expectedAt: new Date("2026-06-08T18:00:00.000Z"),
    });

    expect(plan).toMatchObject({ status: "expected", isPreApproved: true });
  });

  it("approves and then admits a pending visitor", () => {
    expect(applyVisitorTransition({ current: "pending_approval", action: "approve" })).toEqual({
      status: "approved",
    });
    expect(applyVisitorTransition({ current: "approved", action: "enter" })).toEqual({
      status: "inside",
    });
    expect(applyVisitorTransition({ current: "inside", action: "exit" })).toEqual({
      status: "exited",
    });
  });

  it("admits an expected visitor directly on entry", () => {
    expect(applyVisitorTransition({ current: "expected", action: "enter" })).toEqual({
      status: "inside",
    });
  });

  it("rejects illegal transitions", () => {
    expect(() => applyVisitorTransition({ current: "exited", action: "enter" })).toThrow(
      /cannot transition/i,
    );
    expect(() => applyVisitorTransition({ current: "pending_approval", action: "exit" })).toThrow(
      /cannot transition/i,
    );
  });

  it("exposes terminal statuses", () => {
    expect(VISITOR_TERMINAL_STATUSES).toEqual(
      expect.arrayContaining(["exited", "rejected", "cancelled"]),
    );
  });
});

describe("deterministic dedupe keys for offline replay", () => {
  it("builds a stable visitor log dedupe key", () => {
    const args = {
      societyId: "society_a",
      flatNumber: "A-101",
      phone: "9999999999",
      visitorName: "Ravi",
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
    } as const;

    expect(visitorLogDedupeKey(args)).toEqual(visitorLogDedupeKey(args));
    expect(visitorLogDedupeKey(args)).toContain("society_a");
  });

  it("falls back to the visitor name when phone is missing", () => {
    const key = visitorLogDedupeKey({
      societyId: "society_a",
      flatNumber: "A-101",
      visitorName: "Ravi",
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
    });

    expect(key).toContain("Ravi");
  });

  it("builds a stable patrol scan dedupe key", () => {
    const key = patrolScanDedupeKey({
      societyId: "society_a",
      guardId: "guard_1",
      checkpoint: "Gate A",
      scannedAt: new Date("2026-06-07T02:00:00.000Z"),
    });

    expect(key).toBe("society_a:guard_1:Gate A:2026-06-07T02:00:00.000Z");
  });

  it("rejects empty checkpoints", () => {
    expect(() =>
      patrolScanDedupeKey({
        societyId: "society_a",
        guardId: "guard_1",
        checkpoint: "   ",
        scannedAt: new Date(),
      }),
    ).toThrow(/checkpoint/i);
  });
});

describe("visitor passcode", () => {
  it("generates a 6-digit numeric passcode deterministically when seeded", () => {
    expect(generateVisitorPasscode(() => 0)).toBe("000000");
    expect(generateVisitorPasscode(() => 0.123456)).toHaveLength(6);
    expect(/^\d{6}$/.test(generateVisitorPasscode(() => 0.99))).toBe(true);
  });
});

describe("offline guard action envelope", () => {
  it("builds a retry-safe deterministic envelope", () => {
    const envelope = buildGuardActionEnvelope({
      societyId: "society_a",
      guardId: "guard_1",
      action: "log-visitor",
      clientEventId: "evt-123",
      occurredAt: new Date("2026-06-07T10:00:00.000Z"),
      payload: { flatNumber: "A-101" },
    });

    expect(envelope).toMatchObject({
      id: "operations:log-visitor:society_a:evt-123",
      queue: "operations",
      attempts: 5,
      payload: { flatNumber: "A-101" },
    });
  });

  it("requires a client event id for offline replay safety", () => {
    expect(() =>
      buildGuardActionEnvelope({
        societyId: "society_a",
        guardId: "guard_1",
        action: "log-visitor",
        clientEventId: "  ",
        occurredAt: new Date(),
        payload: {},
      }),
    ).toThrow(/client event id/i);
  });
});

describe("package lifecycle", () => {
  it("plans a package intake as received with a dedupe key", () => {
    const plan = planPackageIntake({
      societyId: "society_a",
      flatId: "flat_1",
      courierName: "Amazon",
      loggedBy: "guard_1",
      receivedAt: new Date("2026-06-07T11:00:00.000Z"),
    });

    expect(plan).toMatchObject({ status: "received", courierName: "Amazon" });
    expect(plan.dedupeKey).toContain("flat_1");
  });

  it("moves a package through notify and collect", () => {
    expect(applyPackageTransition({ current: "received", action: "notify" })).toEqual({
      status: "notified",
    });
    expect(applyPackageTransition({ current: "notified", action: "collect" })).toEqual({
      status: "collected",
    });
  });

  it("rejects illegal package transitions", () => {
    expect(() => applyPackageTransition({ current: "collected", action: "notify" })).toThrow(
      /cannot transition/i,
    );
  });

  it("exposes terminal package statuses", () => {
    expect(PACKAGE_TERMINAL_STATUSES).toEqual(
      expect.arrayContaining(["collected", "returned", "lost"]),
    );
  });

  it("builds a stable package intake dedupe key with unknown courier fallback", () => {
    const key = packageIntakeDedupeKey({
      societyId: "society_a",
      flatId: "flat_1",
      receivedAt: new Date("2026-06-07T11:00:00.000Z"),
    });

    expect(key).toBe("society_a:flat_1:unknown:2026-06-07T11:00:00.000Z");
  });

  it("generates a 6-digit pickup OTP", () => {
    expect(generatePickupOtp(() => 0)).toBe("000000");
    expect(/^\d{6}$/.test(generatePickupOtp(() => 0.42))).toBe(true);
  });

  it("verifies a matching pickup OTP and rejects mismatches", () => {
    expect(verifyPackagePickup({ expectedOtp: "123456", providedOtp: "123456" })).toBe(true);
    expect(() => verifyPackagePickup({ expectedOtp: "123456", providedOtp: "000000" })).toThrow(
      /does not match/i,
    );
    expect(() => verifyPackagePickup({ expectedOtp: null, providedOtp: "123456" })).toThrow(
      /no pickup otp/i,
    );
  });
});

describe("domestic staff and attendance", () => {
  it("normalizes supported staff categories and rejects others", () => {
    expect(normalizeStaffCategory("Maid")).toBe("maid");
    expect(() => normalizeStaffCategory("astronaut")).toThrow(/not supported/i);
  });

  it("normalizes attendance methods with a manual default", () => {
    expect(normalizeAttendanceMethod(undefined)).toBe("manual");
    expect(normalizeAttendanceMethod("Code")).toBe("code");
    expect(() => normalizeAttendanceMethod("retina")).toThrow(/not supported/i);
  });

  it("generates a 6-digit staff entry code", () => {
    expect(/^\d{6}$/.test(generateStaffEntryCode(() => 0.7))).toBe(true);
  });

  it("builds a stable attendance dedupe key", () => {
    expect(
      attendanceDedupeKey({
        societyId: "society_a",
        staffId: "staff_1",
        checkIn: new Date("2026-06-07T03:00:00.000Z"),
      }),
    ).toBe("society_a:staff_1:2026-06-07T03:00:00.000Z");
  });

  it("computes attendance duration and rejects negative spans", () => {
    expect(
      computeAttendanceDurationMinutes(
        new Date("2026-06-07T03:00:00.000Z"),
        new Date("2026-06-07T05:30:00.000Z"),
      ),
    ).toBe(150);
    expect(() =>
      computeAttendanceDurationMinutes(
        new Date("2026-06-07T05:00:00.000Z"),
        new Date("2026-06-07T03:00:00.000Z"),
      ),
    ).toThrow(/before check-in/i);
  });
});

describe("parking", () => {
  it("normalizes slot and assignment types and rejects unsupported ones", () => {
    expect(normalizeParkingSlotType("ev")).toBe("EV");
    expect(normalizeParkingAssignmentType("tenant")).toBe("TENANT");
    expect(() => normalizeParkingSlotType("helipad")).toThrow(/not supported/i);
    expect(() => normalizeParkingAssignmentType("alien")).toThrow(/not supported/i);
  });

  it("asserts a slot is assignable", () => {
    expect(() => assertSlotAssignable({ status: "ACTIVE", isAssigned: false })).not.toThrow();
    expect(() => assertSlotAssignable({ status: "ACTIVE", isAssigned: true })).toThrow(
      /already assigned/i,
    );
    expect(() => assertSlotAssignable({ status: "MAINTENANCE", isAssigned: false })).toThrow(
      /not active/i,
    );
  });

  it("summarizes parking capacity", () => {
    expect(
      summarizeParkingCapacity([
        { status: "ACTIVE", isAssigned: false },
        { status: "ACTIVE", isAssigned: true },
        { status: "MAINTENANCE", isAssigned: false },
      ]),
    ).toEqual({ total: 3, available: 1, assigned: 1, blocked: 1 });
  });
});

describe("amenity bookings", () => {
  const policy = {
    bookingWindowDays: 30,
    maxHoursPerBooking: 2,
    cooldownHours: 0,
    cancellationCutoffHours: 24,
    requiresApproval: false,
  };

  it("parses times and computes hours and amount", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
    expect(computeBookingHours("09:00", "11:00")).toBe(2);
    expect(() => computeBookingHours("11:00", "09:00")).toThrow(/after start/i);
    expect(computeBookingAmount(2, 150)).toBe(300);
  });

  it("accepts a valid booking inside policy", () => {
    expect(
      evaluateBookingRequest({
        bookingDate: new Date("2026-06-10T00:00:00.000Z"),
        startTime: "09:00",
        endTime: "11:00",
        now: new Date("2026-06-07T08:00:00.000Z"),
        policy,
      }),
    ).toEqual({ ok: true, errors: [], hours: 2 });
  });

  it("rejects a booking that exceeds max hours, is in the past, or hits a blackout", () => {
    const tooLong = evaluateBookingRequest({
      bookingDate: new Date("2026-06-10T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "13:00",
      now: new Date("2026-06-07T08:00:00.000Z"),
      policy,
    });
    expect(tooLong.ok).toBe(false);
    expect(tooLong.errors.join(" ")).toMatch(/maximum/i);

    const inPast = evaluateBookingRequest({
      bookingDate: new Date("2026-06-06T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      now: new Date("2026-06-07T08:00:00.000Z"),
      policy,
    });
    expect(inPast.ok).toBe(false);
    expect(inPast.errors.join(" ")).toMatch(/past/i);

    const blackout = evaluateBookingRequest({
      bookingDate: new Date("2026-06-10T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "11:00",
      now: new Date("2026-06-07T08:00:00.000Z"),
      policy,
      blackouts: [{ startTime: "10:00", endTime: "12:00" }],
    });
    expect(blackout.ok).toBe(false);
    expect(blackout.errors.join(" ")).toMatch(/blackout/i);
  });

  it("rejects a booking outside the booking window", () => {
    const result = evaluateBookingRequest({
      bookingDate: new Date("2026-08-10T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      now: new Date("2026-06-07T08:00:00.000Z"),
      policy,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/window/i);
  });

  it("enforces the cancellation cutoff", () => {
    expect(() =>
      assertCancellationAllowed({
        start: new Date("2026-06-08T09:00:00.000Z"),
        now: new Date("2026-06-07T08:00:00.000Z"),
        cancellationCutoffHours: 24,
      }),
    ).not.toThrow();
    expect(() =>
      assertCancellationAllowed({
        start: new Date("2026-06-07T18:00:00.000Z"),
        now: new Date("2026-06-07T08:00:00.000Z"),
        cancellationCutoffHours: 24,
      }),
    ).toThrow(/notice/i);
  });

  it("transitions the waitlist", () => {
    expect(applyWaitlistTransition({ current: "waiting", action: "notify" })).toEqual({
      status: "notified",
    });
    expect(applyWaitlistTransition({ current: "notified", action: "book" })).toEqual({
      status: "booked",
    });
    expect(() => applyWaitlistTransition({ current: "booked", action: "notify" })).toThrow(
      /cannot transition/i,
    );
  });
});

describe("vendors and assets", () => {
  it("normalizes vendor categories and asset conditions", () => {
    expect(normalizeVendorCategory("Lift")).toBe("lift");
    expect(normalizeAssetCondition(undefined)).toBe("good");
    expect(() => normalizeVendorCategory("astrology")).toThrow(/not supported/i);
    expect(() => normalizeAssetCondition("haunted")).toThrow(/not supported/i);
  });

  it("computes coverage status for AMC and warranty windows", () => {
    const now = new Date("2026-06-07T00:00:00.000Z");
    expect(computeCoverageStatus({ endDate: null, now })).toBe("none");
    expect(computeCoverageStatus({ endDate: new Date("2026-05-01T00:00:00.000Z"), now })).toBe(
      "expired",
    );
    expect(computeCoverageStatus({ endDate: new Date("2026-06-20T00:00:00.000Z"), now })).toBe(
      "expiring_soon",
    );
    expect(computeCoverageStatus({ endDate: new Date("2026-12-01T00:00:00.000Z"), now })).toBe(
      "active",
    );
  });

  it("computes next maintenance and due state", () => {
    expect(
      computeNextMaintenance({
        lastMaintenanceAt: new Date("2026-06-01T00:00:00.000Z"),
        maintenanceCycleDays: 30,
      }).toISOString(),
    ).toBe("2026-07-01T00:00:00.000Z");
    expect(() =>
      computeNextMaintenance({ lastMaintenanceAt: new Date(), maintenanceCycleDays: 0 }),
    ).toThrow(/greater than zero/i);

    const now = new Date("2026-07-02T00:00:00.000Z");
    expect(isMaintenanceDue({ nextMaintenanceAt: new Date("2026-07-01T00:00:00.000Z"), now })).toBe(
      true,
    );
    expect(isMaintenanceDue({ nextMaintenanceAt: new Date("2026-08-01T00:00:00.000Z"), now })).toBe(
      false,
    );
    expect(isMaintenanceDue({ nextMaintenanceAt: null, now })).toBe(false);
  });
});

describe("incidents, blacklist, and SOS", () => {
  it("normalizes incident types and severities", () => {
    expect(normalizeIncidentType("Theft")).toBe("theft");
    expect(normalizeIncidentSeverity(undefined)).toBe("medium");
    expect(() => normalizeIncidentType("zombie")).toThrow(/not supported/i);
    expect(() => normalizeIncidentSeverity("apocalyptic")).toThrow(/not supported/i);
  });

  it("computes SOS escalation tiers by severity", () => {
    expect(computeSosEscalation("critical")).toEqual({
      severity: "critical",
      tiers: ["guard", "committee", "society_admin", "emergency_services"],
      acknowledgementRequired: true,
    });
    expect(computeSosEscalation("low")).toEqual({
      severity: "low",
      tiers: ["guard"],
      acknowledgementRequired: false,
    });
  });

  it("builds a deterministic SOS dedupe key", () => {
    expect(
      sosDedupeKey({
        societyId: "society_a",
        reportedBy: "resident_1",
        raisedAt: new Date("2026-06-07T09:00:00.000Z"),
      }),
    ).toBe("sos:society_a:resident_1:2026-06-07T09:00:00.000Z");
  });

  it("matches blacklist entries by phone or name", () => {
    const entries = [
      { id: "b1", name: "Bad Actor", phone: "9111111111" },
      { id: "b2", name: "Someone Else", phone: "9222222222" },
    ];

    expect(matchBlacklist({ entries, phone: "9111111111" }).map((entry) => entry.id)).toEqual(["b1"]);
    expect(matchBlacklist({ entries, name: "someone else" }).map((entry) => entry.id)).toEqual(["b2"]);
    expect(matchBlacklist({ entries })).toEqual([]);
  });
});
