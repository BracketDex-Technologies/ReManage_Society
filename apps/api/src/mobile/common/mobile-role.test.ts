import { describe, expect, it } from "vitest";
import { readMobileRuntimeConfig } from "./mobile-config.service.ts";
import {
  defaultMobileRole,
  isPermissionRoleValidForMobileRole,
  normalizeMobileRole,
} from "./mobile-role.ts";

describe("mobile roles", () => {
  it.each([
    ["member", "resident"],
    ["tenant", "resident"],
    ["resident", "resident"],
    ["guard", "guard"],
    ["watchman", "guard"],
  ])("normalizes %s to %s", (source, expected) => {
    expect(normalizeMobileRole(source)).toBe(expected);
  });

  it("does not expose non-MVP personas", () => {
    expect(normalizeMobileRole("chairman")).toBeNull();
    expect(normalizeMobileRole("treasurer")).toBeNull();
  });

  it("prefers resident when both roles are approved", () => {
    expect(defaultMobileRole(["guard", "resident"])).toBe("resident");
  });

  it("rejects a guard assignment with member permission", () => {
    expect(isPermissionRoleValidForMobileRole("guard", "member")).toBe(false);
  });

  it("rejects a resident assignment with guard permission", () => {
    expect(isPermissionRoleValidForMobileRole("resident", "guard")).toBe(false);
  });
});

describe("mobile runtime config", () => {
  it("rejects access while the mobile API is disabled", () => {
    expect(() => readMobileRuntimeConfig({ MOBILE_API_ENABLED: "false" })).toThrow(
      /Mobile API is disabled/,
    );
  });

  it("does not substitute a fallback secret when enabled", () => {
    expect(() =>
      readMobileRuntimeConfig({
        MOBILE_API_ENABLED: "true",
        MOBILE_BETA_SOCIETY_ID: "society_beta",
        MOBILE_REFRESH_TOKEN_PEPPER: "refresh-pepper-with-at-least-32-characters",
        MOBILE_OTP_PEPPER: "otp-pepper-with-at-least-32-characters-xx",
      }),
    ).toThrow(/MOBILE_ACCESS_TOKEN_SECRET/);
  });

  it("returns the fixed mobile session policy", () => {
    expect(
      readMobileRuntimeConfig({
        MOBILE_API_ENABLED: "true",
        MOBILE_BETA_SOCIETY_ID: "society_beta",
        MOBILE_ACCESS_TOKEN_SECRET: "access-secret-with-at-least-32-characters",
        MOBILE_REFRESH_TOKEN_PEPPER: "refresh-pepper-with-at-least-32-characters",
        MOBILE_OTP_PEPPER: "otp-pepper-with-at-least-32-characters-xx",
      }),
    ).toEqual({
      enabled: true,
      betaSocietyId: "society_beta",
      accessTokenSecret: "access-secret-with-at-least-32-characters",
      refreshTokenPepper: "refresh-pepper-with-at-least-32-characters",
      otpPepper: "otp-pepper-with-at-least-32-characters-xx",
      accessTokenTtlSeconds: 600,
      renewableTtlDays: 30,
      otpTtlSeconds: 300,
      otpMaxAttempts: 5,
    });
  });
});
