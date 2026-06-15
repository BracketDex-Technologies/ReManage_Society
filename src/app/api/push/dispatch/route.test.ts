import { describe, expect, it } from "vitest";
import { buildPushPayload } from "@/lib/push/notification-routing";

describe("push dispatch envelope", () => {
  it("builds visitor approval payloads", () => {
    const payload = buildPushPayload({
      type: "visitor",
      tag: "visitor-approval",
      payload: { title: "Visitor waiting", body: "Approve Ravi at gate" },
    });

    expect(payload.url).toBe("/my-visitors");
    expect(payload.tag).toBe("visitor-approval");
  });
});
