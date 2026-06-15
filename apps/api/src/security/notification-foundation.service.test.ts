import { describe, expect, it } from "vitest";
import { NotificationFoundationService } from "./notification-foundation.service.ts";

describe("NotificationFoundationService", () => {
  it("creates idempotent notification jobs with tenant context", () => {
    const service = new NotificationFoundationService({
      now: () => "2026-06-06T08:00:00.000Z",
    });

    expect(
      service.createNotificationJob({
        societyId: "society_a",
        recipientId: "user_123",
        channel: "push",
        template: "notice.published",
        payload: { noticeId: "notice_1" },
      }),
    ).toEqual({
      queue: "notifications",
      idempotencyKey: "society_a:user_123:push:notice.published:notice_1",
      societyId: "society_a",
      recipientId: "user_123",
      channel: "push",
      template: "notice.published",
      payload: { noticeId: "notice_1" },
      status: "queued",
      createdAt: "2026-06-06T08:00:00.000Z",
    });
  });
});
