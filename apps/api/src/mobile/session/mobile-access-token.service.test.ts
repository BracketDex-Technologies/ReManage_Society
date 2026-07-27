import { SignJWT, decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import {
  MobileAccessTokenService,
  type MobileAccessClaims,
} from "./mobile-access-token.service.ts";

const ACCESS_SECRET = "mobile-access-secret-with-at-least-32-characters";

function createConfig(accessTokenSecret = ACCESS_SECRET) {
  return new MobileConfigService({
    MOBILE_API_ENABLED: "true",
    MOBILE_BETA_SOCIETY_ID: "society_a",
    MOBILE_ACCESS_TOKEN_SECRET: accessTokenSecret,
    MOBILE_REFRESH_TOKEN_PEPPER: "refresh-pepper-with-at-least-32-characters",
    MOBILE_OTP_PEPPER: "mobile-otp-pepper-with-at-least-32-characters",
  });
}

const claims: MobileAccessClaims = {
  sub: "user_1",
  sid: "session_1",
  societyId: "society_a",
  membershipId: "membership_1",
  activeRole: "resident",
  activePermissionRole: "member",
  version: 1,
  type: "mobile_access",
};

describe("MobileAccessTokenService", () => {
  it("issues mobile access tokens for the dedicated issuer and audience", async () => {
    const service = new MobileAccessTokenService(createConfig());

    const token = await service.issue(claims);

    await expect(service.verify(token)).resolves.toEqual(claims);
    const payload = decodeJwt(token);
    expect(payload.iss).toBe("remanage-mobile-api");
    expect(payload.aud).toBe("remanage-mobile-app");
  });

  it("sets access-token expiry to exactly ten minutes", async () => {
    const service = new MobileAccessTokenService(createConfig());

    const payload = decodeJwt(await service.issue(claims));

    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));
    expect(payload.exp! - payload.iat!).toBe(600);
  });

  it("rejects a token signed with a different mobile secret", async () => {
    const issuer = new MobileAccessTokenService(createConfig());
    const verifier = new MobileAccessTokenService(
      createConfig("different-mobile-secret-with-at-least-32-characters"),
    );

    const token = await issuer.issue(claims);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it("rejects a validly signed token whose type is not mobile_access", async () => {
    const service = new MobileAccessTokenService(createConfig());
    const token = await new SignJWT({ ...claims, type: "browser_access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("remanage-mobile-api")
      .setAudience("remanage-mobile-app")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(ACCESS_SECRET));

    await expect(service.verify(token)).rejects.toThrow(/mobile_access/i);
  });
});
