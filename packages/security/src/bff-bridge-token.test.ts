import { describe, expect, it } from "vitest";
import { mintBffBridgeToken, verifyBffBridgeToken } from "./bff-bridge-token.ts";

describe("bff-bridge-token", () => {
  it("mints and verifies a bridge token from legacy session claims", async () => {
    const secret = "test-bridge-secret-at-least-32-chars-long";
    const token = await mintBffBridgeToken(
      {
        subject: "user_1",
        societyId: "society_a",
        role: "secretary",
        mfaVerified: true,
      },
      secret,
    );

    const principal = await verifyBffBridgeToken(token, secret);

    expect(principal.subject).toBe("user_1");
    expect(principal.memberships).toEqual([
      {
        societyId: "society_a",
        roles: ["committee"],
        mfaVerified: true,
      },
    ]);
  });

  it("maps guard legacy roles to guard society roles", async () => {
    const secret = "test-bridge-secret-at-least-32-chars-long";
    const token = await mintBffBridgeToken(
      {
        subject: "guard_1",
        societyId: "society_a",
        role: "guard",
      },
      secret,
    );

    const principal = await verifyBffBridgeToken(token, secret);
    expect(principal.memberships[0]?.roles).toEqual(["guard"]);
  });
});
