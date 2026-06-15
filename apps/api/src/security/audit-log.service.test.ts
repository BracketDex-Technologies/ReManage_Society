import { describe, expect, it } from "vitest";
import { createAuditEvent } from "../../../../packages/security/src/index.ts";
import { AuditLogService, type AuditPersistenceClient } from "./audit-log.service.ts";

describe("AuditLogService", () => {
  it("persists immutable security and activity audit records", async () => {
    const writes: unknown[] = [];
    const client: AuditPersistenceClient = {
      securityEvent: {
        create: async (input) => {
          writes.push(["securityEvent", input]);
          return input;
        },
      },
      activityLog: {
        create: async (input) => {
          writes.push(["activityLog", input]);
          return input;
        },
      },
    };
    const service = new AuditLogService(client);

    await service.record(
      createAuditEvent({
        actorId: "user_123",
        societyId: "society_a",
        action: "society:settings.manage",
        targetType: "society",
        targetId: "society_a",
        outcome: "allowed",
        requestId: "req_123",
        timestamp: "2026-06-06T08:00:00.000Z",
      }),
    );

    expect(writes).toMatchObject([
      [
        "securityEvent",
        {
          data: {
            societyId: "society_a",
            userId: "user_123",
            eventType: "society:settings.manage",
            severity: "info",
            path: "req_123",
          },
        },
      ],
      [
        "activityLog",
        {
          data: {
            societyId: "society_a",
            userId: "user_123",
            userName: "user_123",
            action: "society:settings.manage",
            module: "society",
            targetId: "society_a",
          },
        },
      ],
    ]);
  });
});
