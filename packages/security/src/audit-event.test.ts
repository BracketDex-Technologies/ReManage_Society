import { describe, expect, it } from "vitest";
import { createAuditEvent } from "./audit-event.ts";

describe("createAuditEvent", () => {
  it("creates an immutable audit event with tenant and request context", () => {
    const event = createAuditEvent({
      actorId: "user_123",
      societyId: "society_a",
      action: "society:settings.manage",
      targetType: "society",
      targetId: "society_a",
      outcome: "allowed",
      requestId: "req_123",
      timestamp: "2026-06-06T08:00:00.000Z",
    });

    expect(event).toEqual({
      actorId: "user_123",
      societyId: "society_a",
      action: "society:settings.manage",
      targetType: "society",
      targetId: "society_a",
      outcome: "allowed",
      requestId: "req_123",
      timestamp: "2026-06-06T08:00:00.000Z",
      metadata: {},
    });
    expect(Object.isFrozen(event)).toBe(true);
  });
});
