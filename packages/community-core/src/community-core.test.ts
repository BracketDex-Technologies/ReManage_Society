import { describe, expect, it } from "vitest";
import {
  buildCommunityEventEnvelope,
  isNoticeActive,
  isNoticeExpired,
  noticeReadDedupeKey,
  normalizeNoticeCategory,
  planNotice,
} from "./index.ts";

describe("normalizeNoticeCategory", () => {
  it("normalizes case and trims", () => {
    expect(normalizeNoticeCategory(" Emergency ")).toBe("emergency");
  });

  it("defaults to general when not provided", () => {
    expect(normalizeNoticeCategory(undefined)).toBe("general");
  });

  it("rejects unsupported categories", () => {
    expect(() => normalizeNoticeCategory("spam")).toThrow();
  });
});

describe("planNotice", () => {
  it("plans a notice with normalized fields and optional expiry", () => {
    const plan = planNotice({
      societyId: "soc-1",
      title: "  Water shutdown  ",
      body: "No water 10-12",
      category: "Maintenance",
      postedBy: "user-1",
      isPinned: true,
      expiresAt: new Date("2026-06-10T00:00:00.000Z"),
    });

    expect(plan).toEqual({
      societyId: "soc-1",
      title: "Water shutdown",
      body: "No water 10-12",
      category: "maintenance",
      postedBy: "user-1",
      isPinned: true,
      expiresAt: "2026-06-10T00:00:00.000Z",
    });
  });

  it("defaults isPinned to false and omits expiry when absent", () => {
    const plan = planNotice({
      societyId: "soc-1",
      title: "Hello",
      body: "World",
      postedBy: "user-1",
    });

    expect(plan.isPinned).toBe(false);
    expect(plan.category).toBe("general");
    expect("expiresAt" in plan).toBe(false);
  });

  it("rejects empty title or body", () => {
    expect(() =>
      planNotice({ societyId: "soc-1", title: "  ", body: "x", postedBy: "u" }),
    ).toThrow(/title/);
    expect(() =>
      planNotice({ societyId: "soc-1", title: "x", body: "  ", postedBy: "u" }),
    ).toThrow(/body/);
  });
});

describe("notice retention", () => {
  it("treats a notice without expiry as never expiring", () => {
    expect(isNoticeExpired({ now: new Date() })).toBe(false);
    expect(isNoticeActive({ now: new Date() })).toBe(true);
  });

  it("detects expired notices", () => {
    const expiresAt = new Date("2026-06-01T00:00:00.000Z");
    const now = new Date("2026-06-02T00:00:00.000Z");
    expect(isNoticeExpired({ expiresAt, now })).toBe(true);
    expect(isNoticeActive({ expiresAt, now })).toBe(false);
  });

  it("treats the exact expiry boundary as still active", () => {
    const at = new Date("2026-06-01T00:00:00.000Z");
    expect(isNoticeExpired({ expiresAt: at, now: at })).toBe(false);
  });
});

describe("noticeReadDedupeKey", () => {
  it("is deterministic per notice and user", () => {
    expect(noticeReadDedupeKey({ noticeId: "n-1", userId: "u-1" })).toBe("n-1:u-1");
  });

  it("requires identifiers", () => {
    expect(() => noticeReadDedupeKey({ noticeId: "", userId: "u" })).toThrow();
    expect(() => noticeReadDedupeKey({ noticeId: "n", userId: " " })).toThrow();
  });
});

describe("buildCommunityEventEnvelope", () => {
  it("builds a deterministic retry-safe envelope", () => {
    const envelope = buildCommunityEventEnvelope({
      societyId: "soc-1",
      action: "notice.published",
      clientEventId: "evt-1",
      occurredAt: new Date("2026-06-07T10:00:00.000Z"),
      payload: { noticeId: "n-1" },
    });

    expect(envelope).toEqual({
      id: "community:notice.published:soc-1:evt-1",
      queue: "community",
      name: "notice.published",
      attempts: 5,
      societyId: "soc-1",
      occurredAt: "2026-06-07T10:00:00.000Z",
      clientEventId: "evt-1",
      payload: { noticeId: "n-1" },
    });
  });

  it("requires a client event id for replay safety", () => {
    expect(() =>
      buildCommunityEventEnvelope({
        societyId: "soc-1",
        action: "notice.published",
        clientEventId: "  ",
        occurredAt: new Date(),
        payload: {},
      }),
    ).toThrow(/client event id/);
  });
});
