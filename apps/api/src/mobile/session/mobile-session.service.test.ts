import { UnauthorizedException } from "@nestjs/common";
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

function createService(options: {
  refreshedSession?: {
    sessionId: string;
    credential: string;
    expiresAt: Date;
    version: number;
    userId: string;
    membershipId: string;
    societyId: string;
    activeRole: "resident" | "guard";
    activePermissionRole: string;
  };
  refreshError?: Error;
  logoutError?: Error;
} = {}) {
  const sessionInputs: unknown[] = [];
  const refreshCredentials: string[] = [];
  const logoutCredentials: string[] = [];
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
    refresh: async (credential: string) => {
      refreshCredentials.push(credential);
      if (options.refreshError) throw options.refreshError;
      return (
        options.refreshedSession ?? {
          sessionId: "device_session_1",
          credential: "device_session_1.refreshed-renewable-secret",
          expiresAt: new Date("2026-08-14T08:00:00.000Z"),
          version: 8,
          userId: "user_1",
          membershipId: "membership_1",
          societyId: "society_beta",
          activeRole: "resident" as const,
          activePermissionRole: "member",
        }
      );
    },
    logout: async (credential: string) => {
      logoutCredentials.push(credential);
      if (options.logoutError) throw options.logoutError;
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
    refreshCredentials,
    logoutCredentials,
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

  it("issues a refreshed access token for the currently approved replacement role", async () => {
    const { accessClaims, refreshCredentials, service } = createService({
      refreshedSession: {
        sessionId: "device_session_1",
        credential: "device_session_1.refreshed-renewable-secret",
        expiresAt: new Date("2026-08-14T09:15:00.000Z"),
        version: 8,
        userId: "user_1",
        membershipId: "membership_1",
        societyId: "society_beta",
        activeRole: "guard",
        activePermissionRole: "guard",
      },
    });

    const issued = await service.refresh("device_session_1.current-renewable-secret");

    expect(refreshCredentials).toEqual(["device_session_1.current-renewable-secret"]);
    expect(accessClaims).toEqual([
      {
        sub: "user_1",
        sid: "device_session_1",
        societyId: "society_beta",
        membershipId: "membership_1",
        activeRole: "guard",
        activePermissionRole: "guard",
        version: 8,
        type: "mobile_access",
      },
    ]);
    expect(issued).toEqual({
      accessToken: "mobile-access-token",
      accessExpiresAt: "2026-07-15T08:10:00.000Z",
      renewableCredential: "device_session_1.refreshed-renewable-secret",
      renewableExpiresAt: "2026-08-14T09:15:00.000Z",
      deviceSessionId: "device_session_1",
      activeRole: "guard",
    });
  });

  it("does not issue a token when no approved role remains at refresh time", async () => {
    const { accessClaims, refreshCredentials, service } = createService({
      refreshError: new Error("no_approved_role"),
    });

    await expect(
      service.refresh("device_session_1.current-renewable-secret"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshCredentials).toEqual(["device_session_1.current-renewable-secret"]);
    expect(accessClaims).toEqual([]);
  });

  it("does not retry a failed refresh", async () => {
    const { refreshCredentials, service } = createService({
      refreshError: new Error("refresh_reuse_detected"),
    });

    await expect(
      service.refresh("device_session_1.reused-renewable-secret"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshCredentials).toHaveLength(1);
  });

  it("logs out idempotently without exposing credential state", async () => {
    const { logoutCredentials, service } = createService({
      logoutError: new Error("invalid_credential"),
    });

    await expect(
      service.logout("device_session_1.unknown-renewable-secret"),
    ).resolves.toEqual({ loggedOut: true });

    expect(logoutCredentials).toEqual(["device_session_1.unknown-renewable-secret"]);
  });
});
