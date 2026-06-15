import { describe, expect, it } from "vitest";
import { evaluatePermission } from "./permission-policy.ts";
import type { AuthenticatedPrincipal } from "./types.ts";

describe("society core permissions", () => {
  it("allows MFA-verified committee members to manage society core setup", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "committee_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["committee"],
          mfaVerified: true,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal,
        action: "society:core.manage",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: true,
      reason: "Allowed by role committee",
    });
  });

  it("allows residents to read the tenant-scoped resident directory", () => {
    const principal: AuthenticatedPrincipal = {
      subject: "resident_1",
      memberships: [
        {
          societyId: "society_a",
          roles: ["resident"],
          mfaVerified: false,
        },
      ],
      platformRoles: [],
    };

    expect(
      evaluatePermission({
        principal,
        action: "society:directory.read",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: true,
      reason: "Allowed by role resident",
    });
  });
});
