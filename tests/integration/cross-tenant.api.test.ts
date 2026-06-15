import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthenticationGuard } from "../../apps/api/src/security/authentication.guard.ts";
import type { JwtPrincipalVerifier } from "../../apps/api/src/security/jwt-principal-verifier.service.ts";
import { SecurityPolicyService } from "../../apps/api/src/security/security-policy.service.ts";
import {
  committeePrincipal,
  guardPrincipal,
  residentPrincipal,
} from "../../packages/test/src/contract/fixtures.ts";

function executionContext(headers: Record<string, string | undefined>) {
  const request: Record<string, unknown> = { headers };
  return {
    request,
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    },
  };
}

describe("cross-tenant API integration", () => {
  const verifier: JwtPrincipalVerifier = {
    verify: async () => committeePrincipal("society_a"),
  };
  const guard = new AuthenticationGuard(verifier);
  const policy = new SecurityPolicyService();

  it("rejects society A principal with society B x-society-id at auth guard", async () => {
    const { context } = executionContext({
      authorization: "Bearer token_a",
      "x-society-id": "society_b",
    });

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects resident reads for a different society via policy layer", () => {
    expect(() =>
      policy.authorizeOrThrow(residentPrincipal("society_a"), "community:read", "society_b"),
    ).toThrow(ForbiddenException);
  });

  it("rejects finance reads across societies", () => {
    expect(() =>
      policy.authorizeOrThrow(
        committeePrincipal("society_a"),
        "society:finance.read",
        "society_b",
      ),
    ).toThrow(ForbiddenException);
  });

  it("rejects operations reads across societies", () => {
    expect(() =>
      policy.authorizeOrThrow(guardPrincipal("society_a"), "operations:read", "society_b"),
    ).toThrow(ForbiddenException);
  });
});
