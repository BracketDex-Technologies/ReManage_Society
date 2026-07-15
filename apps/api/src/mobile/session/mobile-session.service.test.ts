import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileIdentity } from "../auth/mobile-identity.repository.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import type { MobileAccessClaims } from "./mobile-access-token.service.ts";
import { MobileSessionService } from "./mobile-session.service.ts";

const NOW = new Date("2026-07-15T08:00:00.000Z");

function createConfig() {
  return new MobileConfigService({
    MOBILE_API_ENABLED: "true",
    MOBILE_BETA_SOCIETY_ID: "society_beta",
    MOBILE_ACCESS_TOKEN_SECRET: "mobile-access-secret-with-at-least-32-characters",
    MOBILE_REFRESH_TOKEN_PEPPER: "refresh-pepper-with-at-least-32-characters",
    MOBILE_OTP_PEPPER: "mobile-otp-pepper-with-at-least-32-characters",
  });
}

function identity(roles: MobileIdentity["roles"]): MobileIdentity {
  return {
    userId: "user_1",
    name: "Resident One",
    email: "resident@example.com",
    passwordHash: "stored-password-hash",
    societyId: "society_beta",
    societyName: "Beta Society",
    membershipId: "membership_1",
    flatId: "flat_1",
    roles,
  };
}

function createService() {
  const sessionInputs: unknown[] = [];
  const accessClaims: MobileAccessClaims[] = [];
  const sessionRepository = {
    createSession: async (input: unknown) => {
      sessionInputs.push(input);
      return {
        sessionId: "device_session_1",
        credential: "device_session_1.renewable-secret",
        expiresAt: new Date("2026-08-14T08:00:00.000Z"),
        version: 7,
      };
    },
  };
  const accessTokens = {
    issue: async (claims: MobileAccessClaims) => {
      accessClaims.push(claims);
      return "mobile-access-token";
    },
  };
  return {
    accessClaims,
    sessionInputs,
    service: new MobileSessionService(sessionRepository, accessTokens, createConfig()),
  };
}

describe("MobileSessionService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects the default role, creates a device session, and issues both credentials", async () => {
    const { accessClaims, service, sessionInputs } = createService();

    const issued = await service.issueForIdentity(
      identity([
        { role: "guard", permissionRole: "guard" },
        { role: "resident", permissionRole: "member" },
      ]),
      {
        id: "11111111-1111-4111-8111-111111111111",
        platform: "android",
        appVersion: "1.0.0",
        deviceName: "Pixel 9",
      },
    );

    expect(sessionInputs).toEqual([
      {
        userId: "user_1",
        membershipId: "membership_1",
        societyId: "society_beta",
        installationId: "11111111-1111-4111-8111-111111111111",
        platform: "android",
        appVersion: "1.0.0",
        deviceName: "Pixel 9",
        activeRole: "resident",
        activePermissionRole: "member",
      },
    ]);
    expect(accessClaims).toEqual([
      {
        sub: "user_1",
        sid: "device_session_1",
        societyId: "society_beta",
        membershipId: "membership_1",
        activeRole: "resident",
        activePermissionRole: "member",
        version: 7,
        type: "mobile_access",
      },
    ]);
    expect(issued).toEqual({
      accessToken: "mobile-access-token",
      accessExpiresAt: "2026-07-15T08:10:00.000Z",
      renewableCredential: "device_session_1.renewable-secret",
      renewableExpiresAt: "2026-08-14T08:00:00.000Z",
      deviceSessionId: "device_session_1",
      activeRole: "resident",
    });
    expect(Object.keys(issued)).toEqual([
      "accessToken",
      "accessExpiresAt",
      "renewableCredential",
      "renewableExpiresAt",
      "deviceSessionId",
      "activeRole",
    ]);
  });

  it("uses the compatible guard assignment when Guard is the only approved role", async () => {
    const { accessClaims, service } = createService();

    const issued = await service.issueForIdentity(
      identity([{ role: "guard", permissionRole: "guard" }]),
      {
        id: "22222222-2222-4222-8222-222222222222",
        platform: "ios",
        appVersion: "1.0.0",
      },
    );

    expect(issued.activeRole).toBe("guard");
    expect(accessClaims[0]).toMatchObject({
      activeRole: "guard",
      activePermissionRole: "guard",
      version: 7,
    });
  });
});
