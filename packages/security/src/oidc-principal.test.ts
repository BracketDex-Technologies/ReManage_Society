import { describe, expect, it } from "vitest";
import { mapOidcClaimsToPrincipal } from "./oidc-principal.ts";

describe("mapOidcClaimsToPrincipal", () => {
  it("maps Keycloak-compatible custom claims into a platform principal", () => {
    const principal = mapOidcClaimsToPrincipal({
      sub: "user_123",
      society_memberships: [
        {
          societyId: "society_a",
          roles: ["committee", "resident"],
          mfaVerified: true,
        },
      ],
      platform_roles: ["platform_admin"],
    });

    expect(principal).toEqual({
      subject: "user_123",
      memberships: [
        {
          societyId: "society_a",
          roles: ["committee", "resident"],
          mfaVerified: true,
        },
      ],
      platformRoles: ["platform_admin"],
    });
  });

  it("rejects malformed role claims instead of granting implicit access", () => {
    expect(() =>
      mapOidcClaimsToPrincipal({
        sub: "user_123",
        society_memberships: [
          {
            societyId: "society_a",
            roles: ["owner"],
            mfaVerified: true,
          },
        ],
      }),
    ).toThrow("Invalid society role: owner");
  });
});
