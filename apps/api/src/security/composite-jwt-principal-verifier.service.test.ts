import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { mintBffBridgeToken } from "../../../../packages/security/src/bff-bridge-token.ts";
import { BffBridgeJwtPrincipalVerifier } from "./bff-bridge-jwt-verifier.service.ts";
import { CompositeJwtPrincipalVerifier } from "./composite-jwt-principal-verifier.service.ts";
import type { JwtPrincipalVerifier } from "./jwt-principal-verifier.service.ts";

describe("CompositeJwtPrincipalVerifier", () => {
  it("accepts BFF bridge tokens when bridge mode is enabled", async () => {
    const previous = process.env.API_BFF_BRIDGE_ENABLED;
    process.env.API_BFF_BRIDGE_ENABLED = "true";

    const keycloak: JwtPrincipalVerifier = {
      verify: vi.fn(async () => {
        throw new UnauthorizedException("keycloak should not run");
      }),
    };

    const verifier = new CompositeJwtPrincipalVerifier(
      new BffBridgeJwtPrincipalVerifier(),
      keycloak,
    );
    const token = await mintBffBridgeToken(
      {
        subject: "user_1",
        societyId: "society_a",
        role: "secretary",
      },
      "test-bridge-secret-at-least-32-chars-long",
    );

    process.env.API_BFF_BRIDGE_SECRET = "test-bridge-secret-at-least-32-chars-long";
    const principal = await verifier.verify(token);

    expect(principal.memberships[0]?.roles).toEqual(["committee"]);
    process.env.API_BFF_BRIDGE_ENABLED = previous;
  });
});
