import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { SecurityPolicyService } from "./security-policy.service.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";

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

describe("SecurityPolicyService", () => {
  it("returns an allowed decision for valid tenant-scoped permissions", () => {
    const service = new SecurityPolicyService();

    const decision = service.authorizeOrThrow(
      {
        ...principal,
        memberships: [
          {
            societyId: "society_a",
            roles: ["committee"],
            mfaVerified: true,
          },
        ],
      },
      "audit:event.read",
      "society_a",
    );

    expect(decision).toEqual({
      allowed: true,
      reason: "Allowed by role committee",
    });
  });

  it("throws ForbiddenException when policy denies cross-society access", () => {
    const service = new SecurityPolicyService();

    expect(() =>
      service.authorizeOrThrow(principal, "tenant:membership.read", "society_b"),
    ).toThrow(ForbiddenException);
  });

  it("throws ForbiddenException for privileged finance manage without MFA", () => {
    const service = new SecurityPolicyService();

    expect(() =>
      service.authorizeOrThrow(
        {
          subject: "treasurer_1",
          memberships: [
            { societyId: "society_a", roles: ["treasurer"], mfaVerified: false },
          ],
          platformRoles: [],
        },
        "society:finance.manage",
        "society_a",
      ),
    ).toThrow(ForbiddenException);
  });

  it("throws ForbiddenException for document manage without MFA", () => {
    const service = new SecurityPolicyService();

    expect(() =>
      service.authorizeOrThrow(
        {
          subject: "committee_1",
          memberships: [
            { societyId: "society_a", roles: ["committee"], mfaVerified: false },
          ],
          platformRoles: [],
        },
        "community:document.manage",
        "society_a",
      ),
    ).toThrow(ForbiddenException);
  });
});
