import { describe, expect, it } from "vitest";
import { MobileSessionController } from "./mobile-session.controller.ts";
import type { MobileSessionService } from "./mobile-session.service.ts";

function createController() {
  const refreshCredentials: string[] = [];
  const logoutCredentials: string[] = [];
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
  };
  return {
    refreshCredentials,
    logoutCredentials,
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
});
