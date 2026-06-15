import { describe, expect, it } from "vitest";
import { evaluatePermission } from "./permission-policy.ts";
import type { AuthenticatedPrincipal } from "./types.ts";

const treasurerPrincipal: AuthenticatedPrincipal = {
  subject: "treasurer_1",
  memberships: [
    {
      societyId: "society_a",
      roles: ["treasurer"],
      mfaVerified: true,
    },
  ],
  platformRoles: [],
};

const treasurerWithoutMfa: AuthenticatedPrincipal = {
  subject: "treasurer_2",
  memberships: [
    {
      societyId: "society_a",
      roles: ["treasurer"],
      mfaVerified: false,
    },
  ],
  platformRoles: [],
};

const residentPrincipal: AuthenticatedPrincipal = {
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

describe("finance permissions", () => {
  it("allows treasurers to read and manage finance inside their society", () => {
    expect(
      evaluatePermission({
        principal: treasurerPrincipal,
        action: "society:finance.read",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: true,
      reason: "Allowed by role treasurer",
    });

    expect(
      evaluatePermission({
        principal: treasurerPrincipal,
        action: "society:finance.manage",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: true,
      reason: "Allowed by role treasurer",
    });
  });

  it("requires MFA before treasurers can manage finance", () => {
    expect(
      evaluatePermission({
        principal: treasurerWithoutMfa,
        action: "society:finance.manage",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: false,
      reason: "MFA is required for society:finance.manage",
    });
  });

  it("allows residents to read their finance surfaces but not manage finance", () => {
    expect(
      evaluatePermission({
        principal: residentPrincipal,
        action: "society:finance.read",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: true,
      reason: "Allowed by role resident",
    });

    expect(
      evaluatePermission({
        principal: residentPrincipal,
        action: "society:finance.manage",
        societyId: "society_a",
      }),
    ).toEqual({
      allowed: false,
      reason: "No active role can perform society:finance.manage",
    });
  });
});
