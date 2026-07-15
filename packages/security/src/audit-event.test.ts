import { describe, expect, it } from "vitest";
import { createAuditEvent, type AuditEventInput } from "./audit-event.ts";

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

  it("supports authentication audit actions outside permission decisions", () => {
    const input = {
      actorId: "user_123",
      societyId: "society_a",
      action: "auth:login",
      targetType: "mobile_auth",
      targetId: "user_123",
      outcome: "allowed",
      requestId: "req_auth_123",
    } satisfies AuditEventInput;

    expect(createAuditEvent(input).action).toBe("auth:login");
  });
});
