import { describe, expect, it } from "vitest";
import {
  currentPeriod,
  formatPeriodLabel,
  groupByYear,
  isComplaintHistory,
  isNoticeArchived,
  navigatePeriod,
} from "./history-utils";

describe("formatPeriodLabel", () => {
  it("formats YYYY-MM", () => {
    expect(formatPeriodLabel("2026-06")).toContain("2026");
  });
});

describe("navigatePeriod", () => {
  it("moves to previous month", () => {
    expect(navigatePeriod("2026-06", -1)).toBe("2026-05");
  });
});

describe("groupByYear", () => {
  it("groups records by year descending", () => {
    const grouped = groupByYear(
      [
        { id: "a", paidAt: "2025-03-01" },
        { id: "b", paidAt: "2026-01-15" },
      ],
      (item) => item.paidAt,
    );
    expect(grouped.map((entry) => entry.year)).toEqual(["2026", "2025"]);
  });
});

describe("isComplaintHistory", () => {
  it("marks resolved and closed as history", () => {
    expect(isComplaintHistory("resolved")).toBe(true);
    expect(isComplaintHistory("open")).toBe(false);
  });
});

describe("isNoticeArchived", () => {
  it("keeps pinned notices active", () => {
    expect(
      isNoticeArchived({
        createdAt: "2020-01-01",
        expiresAt: null,
        isPinned: true,
      }),
    ).toBe(false);
  });
});

describe("currentPeriod", () => {
  it("returns YYYY-MM", () => {
    expect(currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });
});
