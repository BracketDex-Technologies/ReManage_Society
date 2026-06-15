import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Phase 2 Keycloak realm export", () => {
  it("defines the local realm, API client, and MFA browser flow", () => {
    const realm = JSON.parse(readFileSync("infra/keycloak/society-connect-realm.json", "utf8"));

    expect(realm.realm).toBe("society-connect");
    expect(realm.clients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientId: "society-api",
          protocol: "openid-connect",
          publicClient: false,
        }),
      ]),
    );
    expect(JSON.stringify(realm)).toContain("society-membership-mapper");
    expect(JSON.stringify(realm)).toContain("CONFIGURE_TOTP");
  });
});
