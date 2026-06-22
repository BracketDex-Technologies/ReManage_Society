import { describe, expect, it } from "vitest";
import { createMfaPendingPayload, createVerifiedMfaPayload } from "./session.ts";

const identity = {
  userId: "chairman_1",
  societyId: "society_1",
  role: "chairman",
  name: "Chairman",
  email: "chairman@example.test",
};

describe("MFA session claims", () => {
  it("creates a short-lived pending MFA session that cannot authorize privileged actions", () => {
    const now = new Date("2026-06-22T12:00:00.000Z");
    const pending = createMfaPendingPayload(identity, now);

    expect(pending).toMatchObject({ mfaPending: true, mfaVerified: false });
    expect(pending.expiresAt.toISOString()).toBe("2026-06-22T12:05:00.000Z");
  });

  it("marks a completed challenge as verified and clears its pending state", () => {
    const now = new Date("2026-06-22T12:00:00.000Z");
    const verified = createVerifiedMfaPayload(identity, now);

    expect(verified).toMatchObject({ mfaPending: false, mfaVerified: true });
    expect(verified.mfaVerifiedAt?.toISOString()).toBe(now.toISOString());
  });
});
