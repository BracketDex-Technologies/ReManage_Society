import { describe, expect, it } from "vitest";
import { visitorLogDedupeKey, patrolScanDedupeKey } from "@society/operations-core";

describe("offline mutation dedupe keys", () => {
  it("builds stable visitor log keys", () => {
    const key = visitorLogDedupeKey({
      societyId: "society_a",
      visitorName: "Ravi",
      flatNumber: "A-101",
      arrivedAt: new Date("2026-06-07T10:00:00.000Z"),
    });

    expect(key).toContain("society_a");
    expect(key).toContain("A-101");
  });

  it("builds stable patrol scan keys", () => {
    const key = patrolScanDedupeKey({
      societyId: "society_a",
      guardId: "guard-1",
      checkpoint: "north-gate",
      scannedAt: new Date("2026-06-07T10:00:00.000Z"),
    });

    expect(key).toContain("north-gate");
  });
});
