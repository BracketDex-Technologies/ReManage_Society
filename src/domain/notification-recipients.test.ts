import { describe, expect, it } from "vitest";
import {
  billDueRecipientUserIds,
  canShowBroadcastNotification,
  requiresNotificationRecipient,
} from "./notification-recipients";

describe("notification recipients", () => {
  it("dedupes and removes empty bill recipient ids", () => {
    expect(
      billDueRecipientUserIds({
        userIds: ["resident-1", "", " resident-2 ", "resident-1", null, undefined],
      })
    ).toEqual(["resident-1", "resident-2"]);
  });

  it("requires flat bill due notifications to be user scoped", () => {
    expect(requiresNotificationRecipient("bill_due")).toBe(true);
    expect(canShowBroadcastNotification("bill_due")).toBe(false);
  });

  it("allows normal society broadcasts", () => {
    expect(requiresNotificationRecipient("notice_new")).toBe(false);
    expect(canShowBroadcastNotification("notice_new")).toBe(true);
  });
});
