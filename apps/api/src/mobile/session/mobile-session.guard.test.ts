import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { MobileAccessClaims } from "./mobile-access-token.service.ts";
import { MobileSessionGuard } from "./mobile-session.guard.ts";

function claims(overrides: Partial<MobileAccessClaims> = {}): MobileAccessClaims {
  return {
    sub: "user_1", sid: "session_1", societyId: "society_beta", membershipId: "membership_1",
    activeRole: "resident", activePermissionRole: "member", version: 1, type: "mobile_access", ...overrides,
  };
}

function live(overrides: Record<string, unknown> = {}) {
  return {
    session: { id: "session_1", userId: "user_1", membershipId: "membership_1", societyId: "society_beta", activeRole: "resident" as const, activePermissionRole: "member" as const, version: 1, ...overrides },
    user: { id: "user_1", name: "Resident One", email: "resident@example.com" },
    society: { id: "society_beta", name: "Beta Society" },
    approvedRoles: [{ role: "resident" as const, permissionRole: "member" as const }],
  };
}

function request(headers: Record<string, string | undefined> = {}) {
  return { headers } as never;
}

function context(value: ReturnType<typeof request>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => value }) } as never;
}

function guard(options: { tokenError?: Error; current?: ReturnType<typeof live> | null } = {}) {
  return new MobileSessionGuard(
    { verify: async () => { if (options.tokenError) throw options.tokenError; return claims(); } },
    { findLiveSession: async () => options.current === undefined ? live() : options.current },
  );
}

describe("MobileSessionGuard", () => {
  it("rejects missing bearer credentials", async () => {
    await expect(guard().canActivate(context(request()))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an invalid token", async () => {
    await expect(guard({ tokenError: new Error("bad signature") }).canActivate(context(request({ authorization: "Bearer token" })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(["unknown", "expired", "revoked", "deactivated membership"])("rejects a %s live session", async () => {
    await expect(guard({ current: null }).canActivate(context(request({ authorization: "Bearer token" })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a token whose session version has been superseded", async () => {
    await expect(guard({ current: live({ version: 2 }) }).canActivate(context(request({ authorization: "Bearer token" })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects active role or permission-role substitution", async () => {
    const activeRoleMismatch = new MobileSessionGuard(
      { verify: async () => claims({ activeRole: "guard", activePermissionRole: "guard" }) },
      { findLiveSession: async () => live() },
    );
    await expect(activeRoleMismatch.canActivate(context(request({ authorization: "Bearer token" })))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches only the validated active permission role", async () => {
    const value = request({ authorization: "Bearer token" });
    await expect(guard().canActivate(context(value))).resolves.toBe(true);
    expect(value.mobileSession).toEqual({ sessionId: "session_1", userId: "user_1", membershipId: "membership_1", societyId: "society_beta", activeRole: "resident", activePermissionRole: "member", version: 1 });
    expect(value.principal).toEqual({ subject: "user_1", memberships: [{ societyId: "society_beta", roles: ["member"], mfaVerified: false }], platformRoles: [] });
  });
});
