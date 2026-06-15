import { describe, expect, it } from "vitest";
import {
  applyEventTransition,
  assertRsvpCapacity,
  eventRsvpDedupeKey,
  normalizeEventCategory,
  normalizeRsvpResponse,
} from "./index.ts";

describe("event normalization", () => {
  it("normalizes category and rsvp response with defaults", () => {
    expect(normalizeEventCategory(undefined)).toBe("general");
    expect(normalizeEventCategory("Festival")).toBe("festival");
    expect(normalizeRsvpResponse(undefined)).toBe("attending");
    expect(normalizeRsvpResponse("DECLINED")).toBe("declined");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeEventCategory("rave")).toThrow();
    expect(() => normalizeRsvpResponse("perhaps")).toThrow();
  });
});

describe("applyEventTransition", () => {
  it("walks the event lifecycle", () => {
    expect(applyEventTransition({ current: "upcoming", action: "start" })).toEqual({
      status: "ongoing",
    });
    expect(applyEventTransition({ current: "ongoing", action: "complete" })).toEqual({
      status: "completed",
    });
    expect(applyEventTransition({ current: "upcoming", action: "cancel" })).toEqual({
      status: "cancelled",
    });
  });

  it("rejects illegal transitions", () => {
    expect(() => applyEventTransition({ current: "completed", action: "start" })).toThrow();
    expect(() => applyEventTransition({ current: "cancelled", action: "complete" })).toThrow();
  });
});

describe("assertRsvpCapacity", () => {
  it("ignores non-attending responses and uncapped events", () => {
    expect(() =>
      assertRsvpCapacity({ maxAttendees: 0, currentAttending: 10, willAttend: false }),
    ).not.toThrow();
    expect(() =>
      assertRsvpCapacity({ maxAttendees: null, currentAttending: 10, willAttend: true }),
    ).not.toThrow();
  });

  it("allows attending until capacity, then blocks", () => {
    expect(() =>
      assertRsvpCapacity({ maxAttendees: 2, currentAttending: 1, willAttend: true }),
    ).not.toThrow();
    expect(() =>
      assertRsvpCapacity({ maxAttendees: 2, currentAttending: 2, willAttend: true }),
    ).toThrow(/full/);
  });
});

describe("eventRsvpDedupeKey", () => {
  it("is deterministic per event and user", () => {
    expect(eventRsvpDedupeKey({ eventId: "e1", userId: "u1" })).toBe("e1:u1");
    expect(() => eventRsvpDedupeKey({ eventId: "", userId: "u1" })).toThrow();
  });
});
