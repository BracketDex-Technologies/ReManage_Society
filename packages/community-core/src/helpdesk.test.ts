import { describe, expect, it } from "vitest";
import {
  applyComplaintTransition,
  assertSatisfactionRating,
  computeSlaDueAt,
  defaultSlaHours,
  escalationTarget,
  isSlaBreached,
  nextEscalationLevel,
  normalizeComplaintCategory,
  normalizeComplaintPriority,
} from "./index.ts";

describe("complaint normalization", () => {
  it("normalizes category and priority with defaults", () => {
    expect(normalizeComplaintCategory(undefined)).toBe("general");
    expect(normalizeComplaintCategory(" Plumbing ")).toBe("plumbing");
    expect(normalizeComplaintPriority(undefined)).toBe("medium");
    expect(normalizeComplaintPriority("URGENT")).toBe("urgent");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeComplaintCategory("aliens")).toThrow();
    expect(() => normalizeComplaintPriority("yesterday")).toThrow();
  });
});

describe("applyComplaintTransition", () => {
  it("walks the lifecycle", () => {
    expect(applyComplaintTransition({ current: "open", action: "start" })).toEqual({
      status: "in_progress",
    });
    expect(applyComplaintTransition({ current: "in_progress", action: "resolve" })).toEqual({
      status: "resolved",
    });
    expect(applyComplaintTransition({ current: "resolved", action: "reopen" })).toEqual({
      status: "in_progress",
    });
    expect(applyComplaintTransition({ current: "closed", action: "reopen" })).toEqual({
      status: "open",
    });
  });

  it("rejects illegal transitions", () => {
    expect(() => applyComplaintTransition({ current: "closed", action: "resolve" })).toThrow();
    expect(() => applyComplaintTransition({ current: "open", action: "reopen" })).toThrow();
  });
});

describe("SLA", () => {
  it("derives default hours by priority", () => {
    expect(defaultSlaHours("urgent")).toBe(4);
    expect(defaultSlaHours("low")).toBe(72);
  });

  it("computes a due date and detects breach only while open", () => {
    const createdAt = new Date("2026-06-07T00:00:00.000Z");
    const dueAt = computeSlaDueAt({ createdAt, slaHours: 4 });
    expect(dueAt.toISOString()).toBe("2026-06-07T04:00:00.000Z");

    const now = new Date("2026-06-07T05:00:00.000Z");
    expect(isSlaBreached({ dueAt, now, status: "open" })).toBe(true);
    expect(isSlaBreached({ dueAt, now, status: "in_progress" })).toBe(true);
    expect(isSlaBreached({ dueAt, now, status: "resolved" })).toBe(false);
    expect(isSlaBreached({ dueAt, now, status: "closed" })).toBe(false);
  });

  it("rejects non-positive SLA hours", () => {
    expect(() => computeSlaDueAt({ createdAt: new Date(), slaHours: 0 })).toThrow();
  });
});

describe("escalation", () => {
  it("caps escalation at chairman", () => {
    expect(nextEscalationLevel(0)).toBe(1);
    expect(nextEscalationLevel(1)).toBe(2);
    expect(nextEscalationLevel(2)).toBe(2);
    expect(escalationTarget(0)).toBe("none");
    expect(escalationTarget(1)).toBe("secretary");
    expect(escalationTarget(2)).toBe("chairman");
    expect(escalationTarget(99)).toBe("chairman");
  });
});

describe("assertSatisfactionRating", () => {
  it("accepts 1-5 and rejects others", () => {
    expect(assertSatisfactionRating(5)).toBe(5);
    expect(() => assertSatisfactionRating(0)).toThrow();
    expect(() => assertSatisfactionRating(6)).toThrow();
    expect(() => assertSatisfactionRating(3.5)).toThrow();
  });
});
