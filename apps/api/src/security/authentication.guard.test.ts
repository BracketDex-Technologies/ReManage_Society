import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthenticationGuard } from "./authentication.guard.ts";
import type { JwtPrincipalVerifier } from "./jwt-principal-verifier.service.ts";

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

describe("AuthenticationGuard", () => {
  it("attaches authenticated principal and tenant context from bearer token and x-society-id", async () => {
    const verifier: JwtPrincipalVerifier = {
      verify: async () => ({
        subject: "user_123",
        memberships: [
          {
            societyId: "society_a",
            roles: ["committee"],
            mfaVerified: true,
          },
        ],
        platformRoles: [],
      }),
    };
    const guard = new AuthenticationGuard(verifier);
    const { context, request } = executionContext({
      authorization: "Bearer token_123",
      "x-society-id": "society_a",
    });

    await expect(guard.canActivate(context as never)).resolves.toBe(true);

    expect(request.principal).toMatchObject({ subject: "user_123" });
    expect(request.tenant).toMatchObject({
      actorId: "user_123",
      societyId: "society_a",
      roles: ["committee"],
    });
  });

  it("rejects cross-society tenant switching", async () => {
    const verifier: JwtPrincipalVerifier = {
      verify: async () => ({
        subject: "user_123",
        memberships: [
          {
            societyId: "society_a",
            roles: ["committee"],
            mfaVerified: true,
          },
        ],
        platformRoles: [],
      }),
    };
    const guard = new AuthenticationGuard(verifier);
    const { context } = executionContext({
      authorization: "Bearer token_123",
      "x-society-id": "society_b",
    });

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects missing bearer tokens", async () => {
    const verifier: JwtPrincipalVerifier = {
      verify: async () => {
        throw new Error("should not verify without token");
      },
    };
    const guard = new AuthenticationGuard(verifier);
    const { context } = executionContext({ "x-society-id": "society_a" });

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
