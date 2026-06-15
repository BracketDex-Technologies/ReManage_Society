import { describe, expect, it } from "vitest";
import { mapOidcClaimsToPrincipal } from "./oidc-principal.ts";

describe("mapOidcClaimsToPrincipal MFA claims", () => {
  it("marks memberships MFA-verified when Keycloak AMR includes otp", () => {
    const principal = mapOidcClaimsToPrincipal({
      sub: "committee_1",
      amr: ["pwd", "otp"],
      society_memberships: [
        {
          societyId: "society_a",
          roles: ["committee"],
          mfaVerified: false,
        },
      ],
    });

    expect(principal.memberships[0]?.mfaVerified).toBe(true);
  });
});
