import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { evaluatePermission } from "@society/security";
import { SecurityPolicyService } from "../../apps/api/src/security/security-policy.service.ts";
import { committeePrincipal, treasurerPrincipal } from "../../packages/test/src/contract/fixtures.ts";

describe("MFA privileged integration", () => {
  const policy = new SecurityPolicyService();

  it("denies society:finance.manage without MFA", () => {
    expect(() =>
      policy.authorizeOrThrow(
        treasurerPrincipal("society_a", { mfaVerified: false }),
        "society:finance.manage",
        "society_a",
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows society:finance.manage with MFA", () => {
    expect(
      policy.authorizeOrThrow(
        treasurerPrincipal("society_a", { mfaVerified: true }),
        "society:finance.manage",
        "society_a",
      ),
    ).toMatchObject({ allowed: true });
  });

  it("denies community:document.manage without MFA", () => {
    const decision = evaluatePermission({
      principal: committeePrincipal("society_a", { mfaVerified: false }),
      action: "community:document.manage",
      societyId: "society_a",
    });
    expect(decision).toEqual({
      allowed: false,
      reason: "MFA is required for community:document.manage",
    });
  });

  it("denies operations:manage without MFA", () => {
    const decision = evaluatePermission({
      principal: committeePrincipal("society_a", { mfaVerified: false }),
      action: "operations:manage",
      societyId: "society_a",
    });
    expect(decision).toEqual({
      allowed: false,
      reason: "MFA is required for operations:manage",
    });
  });

  it("allows operations:manage with MFA", () => {
    const decision = evaluatePermission({
      principal: committeePrincipal("society_a", { mfaVerified: true }),
      action: "operations:manage",
      societyId: "society_a",
    });
    expect(decision.allowed).toBe(true);
  });
});
