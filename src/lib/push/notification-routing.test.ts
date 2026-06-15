import { describe, expect, it } from "vitest";
import { buildPushPayload, resolveNotificationUrl } from "./notification-routing.ts";

describe("resolveNotificationUrl", () => {
  it("routes visitor approvals to my visitors", () => {
    expect(resolveNotificationUrl({ type: "visitor", tag: "visitor-approval" })).toBe("/my-visitors");
  });

  it("routes SOS alerts to emergency", () => {
    expect(resolveNotificationUrl({ type: "operations", tag: "sos-alert" })).toBe("/emergency");
  });

  it("falls back to payload url", () => {
    expect(
      resolveNotificationUrl({
        type: "custom",
        payload: { url: "/packages" },
      }),
    ).toBe("/packages");
  });
});

describe("buildPushPayload", () => {
  it("marks emergency notifications", () => {
    const payload = buildPushPayload({
      type: "operations",
      tag: "sos-alert",
      payload: { title: "SOS", body: "Help needed" },
    });

    expect(payload.priority).toBe("emergency");
    expect(payload.url).toBe("/emergency");
  });
});
