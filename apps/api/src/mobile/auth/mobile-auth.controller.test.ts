import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import type { MobileSessionIssueDto } from "../session/dto/mobile-session.dto.ts";
import type { PasswordLoginRequestDto } from "./dto/mobile-auth.dto.ts";
import { MobileAuthController } from "./mobile-auth.controller.ts";
import type { MobileAuthService } from "./mobile-auth.service.ts";

const BODY: PasswordLoginRequestDto = {
  identifier: "resident@example.com",
  password: "password",
  installation: {
    id: "11111111-1111-4111-8111-111111111111",
    platform: "android",
    appVersion: "1.0.0",
  },
};

const ISSUE: MobileSessionIssueDto = {
  accessToken: "access-token",
  accessExpiresAt: "2026-07-15T08:10:00.000Z",
  renewableCredential: "renewable-credential",
  renewableExpiresAt: "2026-08-14T08:00:00.000Z",
  deviceSessionId: "session_1",
  activeRole: "resident",
};

function createController() {
  const calls: unknown[] = [];
  const auth = {
    passwordLogin: async (body: PasswordLoginRequestDto, context: unknown) => {
      calls.push({ body, context });
      return ISSUE;
    },
  };
  return {
    calls,
    controller: new MobileAuthController(auth as unknown as MobileAuthService),
  };
}

describe("MobileAuthController", () => {
  it("uses Fastify request context and ignores a spoofed request-ID header", async () => {
    const { calls, controller } = createController();

    await expect(
      controller.password(
        {
          id: undefined,
          ip: "203.0.113.9",
          headers: { "x-request-id": "client-controlled-request-id" },
        } as unknown as FastifyRequest,
        BODY,
      ),
    ).resolves.toEqual(ISSUE);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      body: BODY,
      context: {
        networkAddress: "203.0.113.9",
        requestId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
      },
    });
    expect(JSON.stringify(calls[0])).not.toContain("client-controlled-request-id");
  });

  it("forwards the trusted Fastify request ID", async () => {
    const { calls, controller } = createController();

    await controller.password(
      {
        id: "fastify-request-id",
        ip: "203.0.113.10",
        headers: { "x-request-id": "client-controlled-request-id" },
      } as unknown as FastifyRequest,
      BODY,
    );

    expect(calls[0]).toMatchObject({
      context: {
        networkAddress: "203.0.113.10",
        requestId: "fastify-request-id",
      },
    });
  });
});
