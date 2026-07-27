import { describe, expect, it } from "vitest";
import { MobileSessionController } from "./mobile-session.controller.ts";
import type { MobileSessionService } from "./mobile-session.service.ts";

function createController() {
  const refreshCredentials: string[] = [];
  const logoutCredentials: string[] = [];
  const bootstrapSessions: unknown[] = [];
  const roleSwitches: unknown[] = [];
  const sessions = {
    refresh: async (credential: string) => {
      refreshCredentials.push(credential);
      return {
        accessToken: "access-token",
        accessExpiresAt: "2026-07-15T08:10:00.000Z",
        renewableCredential: "renewed-credential",
        renewableExpiresAt: "2026-08-14T08:00:00.000Z",
        deviceSessionId: "session_1",
        activeRole: "resident" as const,
      };
    },
    logout: async (credential: string) => {
      logoutCredentials.push(credential);
      return { loggedOut: true as const };
    },
    bootstrap: async (session: unknown) => {
      bootstrapSessions.push(session);
      return { activeRole: "resident" as const, approvedRoles: ["resident" as const] };
    },
    switchRole: async (session: unknown, role: string, requestId: string) => {
      roleSwitches.push({ session, role, requestId });
      return { accessToken: "replacement-token", accessExpiresAt: "2026-07-15T08:10:00.000Z", bootstrap: { activeRole: role } };
    },
  };
  return {
    refreshCredentials,
    logoutCredentials,
    bootstrapSessions,
    roleSwitches,
    controller: new MobileSessionController(sessions as unknown as MobileSessionService),
  };
}

describe("MobileSessionController", () => {
  it("forwards the renewable credential to refresh", async () => {
    const { controller, refreshCredentials } = createController();

    await expect(
      controller.refresh({ renewableCredential: "session_1.current-credential" }),
    ).resolves.toMatchObject({ accessToken: "access-token" });

    expect(refreshCredentials).toEqual(["session_1.current-credential"]);
  });

  it("returns a public idempotent logout result", async () => {
    const { controller, logoutCredentials } = createController();

    await expect(
      controller.logout({ renewableCredential: "session_1.current-credential" }),
    ).resolves.toEqual({ loggedOut: true });

    expect(logoutCredentials).toEqual(["session_1.current-credential"]);
  });

  it("forwards only guard-attached session state to bootstrap", async () => {
    const { bootstrapSessions, controller } = createController();
    const request = { mobileSession: { sessionId: "session_1", userId: "user_1", membershipId: "membership_1", societyId: "society_beta", activeRole: "resident" as const, activePermissionRole: "member", version: 1 } };

    await expect(controller.bootstrap(request as never)).resolves.toMatchObject({ activeRole: "resident" });
    expect(bootstrapSessions).toEqual([request.mobileSession]);
  });

  it("forwards the selected canonical role with the trusted Fastify request id", async () => {
    const { controller, roleSwitches } = createController();
    const request = { id: "req_123", mobileSession: { sessionId: "session_1", userId: "user_1", membershipId: "membership_1", societyId: "society_beta", activeRole: "resident" as const, activePermissionRole: "member", version: 1 } };

    await expect(controller.activeRole(request as never, { role: "guard" })).resolves.toMatchObject({ accessToken: "replacement-token" });
    expect(roleSwitches).toEqual([{ session: request.mobileSession, role: "guard", requestId: "req_123" }]);
  });
});
