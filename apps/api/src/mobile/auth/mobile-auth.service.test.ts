import { createHash } from "node:crypto";
import { hashSync } from "bcryptjs";
import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { RateLimitStore } from "../../security/rate-limit.service.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import type { MobileSessionIssueDto } from "../session/dto/mobile-session.dto.ts";
import type { PasswordLoginRequestDto } from "./dto/mobile-auth.dto.ts";
import type { MobileIdentity } from "./mobile-identity.repository.ts";
import {
  MobileAuthService,
  MobilePasswordRateLimitService,
  type MobileAuthAudit,
  type MobilePasswordRateLimiter,
} from "./mobile-auth.service.ts";

const PASSWORD = "correct horse battery staple";
const PASSWORD_HASH = hashSync(PASSWORD, 4);
const ISSUE: MobileSessionIssueDto = {
  accessToken: "issued-access-token",
  accessExpiresAt: "2026-07-15T08:10:00.000Z",
  renewableCredential: "session_1.issued-renewable-secret",
  renewableExpiresAt: "2026-08-14T08:00:00.000Z",
  deviceSessionId: "session_1",
  activeRole: "resident",
};

function createConfig() {
  return new MobileConfigService({
    MOBILE_API_ENABLED: "true",
    MOBILE_BETA_SOCIETY_ID: "society_beta",
    MOBILE_ACCESS_TOKEN_SECRET: "mobile-access-secret-with-at-least-32-characters",
    MOBILE_REFRESH_TOKEN_PEPPER: "refresh-pepper-with-at-least-32-characters",
    MOBILE_OTP_PEPPER: "mobile-otp-pepper-with-at-least-32-characters",
  });
}

function loginBody(overrides: Partial<PasswordLoginRequestDto> = {}): PasswordLoginRequestDto {
  return {
    identifier: "  Resident@Example.COM  ",
    password: PASSWORD,
    installation: {
      id: "11111111-1111-4111-8111-111111111111",
      platform: "android",
      appVersion: "1.0.0",
      deviceName: "Pixel 9",
    },
    ...overrides,
  };
}

function approvedIdentity(): MobileIdentity {
  return {
    userId: "user_1",
    name: "Resident One",
    email: "resident@example.com",
    passwordHash: PASSWORD_HASH,
    societyId: "society_beta",
    societyName: "Beta Society",
    membershipId: "membership_1",
    flatId: "flat_1",
    roles: [{ role: "resident", permissionRole: "member" }],
  };
}

class FakeRateLimiter implements MobilePasswordRateLimiter {
  readonly calls: unknown[] = [];
  rejectWhen?: "installation" | "network";

  async checkOrThrow(input: {
    identifierHash: string;
    installationId: string;
    networkAddress: string;
  }): Promise<void> {
    this.calls.push(input);
    if (this.rejectWhen === "installation" && input.installationId.includes("11111111")) {
      throw Object.assign(new Error("rate_limit_exceeded"), {
        response: { error: "rate_limit_exceeded" },
        status: 429,
      });
    }
    if (this.rejectWhen === "network" && input.networkAddress === "203.0.113.9") {
      throw Object.assign(new Error("rate_limit_exceeded"), {
        response: { error: "rate_limit_exceeded" },
        status: 429,
      });
    }
  }
}

class FakeAudit implements MobileAuthAudit {
  readonly events: Parameters<MobileAuthAudit["record"]>[0][] = [];
  failure?: Error;

  async record(event: Parameters<MobileAuthAudit["record"]>[0]): Promise<void> {
    this.events.push(event);
    if (this.failure) throw this.failure;
  }
}

function createService(identity: MobileIdentity | null = approvedIdentity()) {
  const identityCalls: string[] = [];
  const sessionCalls: unknown[] = [];
  const audit = new FakeAudit();
  const rateLimiter = new FakeRateLimiter();
  const identities = {
    findApprovedByEmail: async (identifier: string) => {
      identityCalls.push(identifier);
      return identity;
    },
  };
  const sessions = {
    issueForIdentity: async (found: MobileIdentity, installation: unknown) => {
      sessionCalls.push({ identity: found, installation });
      return ISSUE;
    },
  };
  return {
    audit,
    identityCalls,
    rateLimiter,
    sessionCalls,
    service: new MobileAuthService(
      createConfig(),
      identities,
      sessions,
      audit,
      rateLimiter,
    ),
  };
}

async function readPublicError(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error("Expected password login to fail");
  } catch (error) {
    const failure = error as { response?: unknown; status?: number };
    return { response: failure.response, status: failure.status };
  }
}

describe("MobileAuthService password login", () => {
  it("creates a device session and returns access and renewable credentials for a correct password", async () => {
    const { audit, identityCalls, rateLimiter, service, sessionCalls } = createService();

    await expect(
      service.passwordLogin(loginBody(), {
        networkAddress: "203.0.113.9",
        requestId: "request_1",
      }),
    ).resolves.toEqual(ISSUE);

    expect(identityCalls).toEqual(["  Resident@Example.COM  "]);
    expect(sessionCalls).toEqual([
      {
        identity: approvedIdentity(),
        installation: loginBody().installation,
      },
    ]);
    expect(rateLimiter.calls).toEqual([
      {
        identifierHash: createHash("sha256").update("resident@example.com").digest("hex"),
        installationId: "11111111-1111-4111-8111-111111111111",
        networkAddress: "203.0.113.9",
      },
    ]);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      actorId: "user_1",
      societyId: "society_beta",
      action: "auth:login",
      outcome: "allowed",
      requestId: "request_1",
      metadata: {
        method: "password",
        installationId: "11111111-1111-4111-8111-111111111111",
      },
    });
  });

  it.each(["missing account", "inactive account", "unapproved membership"])(
    "returns the generic invalid_credentials error for a %s",
    async () => {
      const { audit, service, sessionCalls } = createService(null);

      const failure = await readPublicError(
        service.passwordLogin(loginBody(), {
          networkAddress: "203.0.113.9",
          requestId: "request_denied",
        }),
      );

      expect(failure).toEqual({
        response: { error: "invalid_credentials" },
        status: 401,
      });
      expect(sessionCalls).toHaveLength(0);
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0]).toMatchObject({
        actorId: "anonymous",
        societyId: "society_beta",
        action: "auth:login",
        outcome: "denied",
      });
    },
  );

  it("returns the same generic invalid_credentials error for a wrong password", async () => {
    const { service, sessionCalls } = createService();

    const failure = await readPublicError(
      service.passwordLogin(loginBody({ password: "wrong-password" }), {
        networkAddress: "203.0.113.9",
        requestId: "request_wrong_password",
      }),
    );

    expect(failure).toEqual({
      response: { error: "invalid_credentials" },
      status: 401,
    });
    expect(sessionCalls).toHaveLength(0);
  });

  it("preserves invalid_credentials when denied-login audit delivery fails", async () => {
    const warning = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { audit, service } = createService(null);
    audit.failure = new Error(
      `audit unavailable ${PASSWORD} resident@example.com ${ISSUE.accessToken}`,
    );

    try {
      const failure = await readPublicError(
        service.passwordLogin(loginBody(), {
          networkAddress: "203.0.113.9",
          requestId: "request_denied_audit_outage",
        }),
      );

      expect(failure).toEqual({
        response: { error: "invalid_credentials" },
        status: 401,
      });
      expect(warning.mock.calls).toEqual([
        ["Mobile authentication audit delivery failed"],
      ]);
    } finally {
      warning.mockRestore();
    }
  });

  it("returns issued credentials when successful-login audit delivery fails", async () => {
    const warning = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { audit, service } = createService();
    audit.failure = new Error(
      `audit unavailable ${PASSWORD} resident@example.com ${ISSUE.renewableCredential}`,
    );

    try {
      await expect(
        service.passwordLogin(loginBody(), {
          networkAddress: "203.0.113.9",
          requestId: "request_success_audit_outage",
        }),
      ).resolves.toEqual(ISSUE);
      expect(warning.mock.calls).toEqual([
        ["Mobile authentication audit delivery failed"],
      ]);
    } finally {
      warning.mockRestore();
    }
  });

  it.each(["installation", "network"] as const)(
    "applies password-login rate limiting by %s",
    async (dimension) => {
      const { identityCalls, rateLimiter, service } = createService();
      rateLimiter.rejectWhen = dimension;

      await expect(
        service.passwordLogin(loginBody(), {
          networkAddress: "203.0.113.9",
          requestId: `request_${dimension}`,
        }),
      ).rejects.toMatchObject({
        response: { error: "rate_limit_exceeded" },
        status: 429,
      });
      expect(identityCalls).toHaveLength(0);
    },
  );

  it("keeps password, normalized identifier, and both credentials out of logs, audit metadata, and limiter input", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { audit, rateLimiter, service } = createService();

    try {
      await service.passwordLogin(loginBody(), {
        networkAddress: "203.0.113.9",
        requestId: "request_secret_check",
      });

      const captured = JSON.stringify({
        audit: audit.events,
        rateLimit: rateLimiter.calls,
      });
      expect(captured).not.toContain(PASSWORD);
      expect(captured).not.toContain("resident@example.com");
      expect(captured).not.toContain(ISSUE.accessToken);
      expect(captured).not.toContain(ISSUE.renewableCredential);
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it("checks the enabled flag before identity lookup", async () => {
    const { identityCalls, service } = createService();
    Object.defineProperty(
      (service as unknown as { config: MobileConfigService }).config.value,
      "enabled",
      { value: false },
    );

    await expect(
      service.passwordLogin(loginBody(), {
        networkAddress: "203.0.113.9",
        requestId: "request_disabled",
      }),
    ).rejects.toMatchObject({
      response: { error: "mobile_api_disabled" },
      status: 503,
    });
    expect(identityCalls).toHaveLength(0);
  });
});

class RecordingStore implements RateLimitStore {
  readonly counts = new Map<string, number>();

  async increment(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}

describe("MobilePasswordRateLimitService", () => {
  it("counts every dimension on each attempt and enforces 10 identifier attempts", async () => {
    const store = new RecordingStore();
    const limiter = new MobilePasswordRateLimitService(store);
    const input = {
      identifierHash: "identifier-hash",
      installationId: "installation-1",
      networkAddress: "203.0.113.9",
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(limiter.checkOrThrow(input)).resolves.toBeUndefined();
    }
    await expect(limiter.checkOrThrow(input)).rejects.toMatchObject({ status: 429 });

    expect([...store.counts.entries()]).toEqual(
      expect.arrayContaining([
        [expect.stringContaining(":identifier-hash:"), 11],
        [expect.stringContaining(":installation-1:"), 11],
        [expect.stringContaining(":203.0.113.9:"), 11],
      ]),
    );
  });

  it("enforces 20 attempts for one installation independently", async () => {
    const store = new RecordingStore();
    const limiter = new MobilePasswordRateLimitService(store);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(
        limiter.checkOrThrow({
          identifierHash: `identifier-${attempt}`,
          installationId: "installation-shared",
          networkAddress: `203.0.113.${attempt}`,
        }),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.checkOrThrow({
        identifierHash: "identifier-21",
        installationId: "installation-shared",
        networkAddress: "203.0.113.21",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("enforces 30 attempts for one network address independently", async () => {
    const store = new RecordingStore();
    const limiter = new MobilePasswordRateLimitService(store);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await expect(
        limiter.checkOrThrow({
          identifierHash: `identifier-${attempt}`,
          installationId: `installation-${attempt}`,
          networkAddress: "203.0.113.9",
        }),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.checkOrThrow({
        identifierHash: "identifier-31",
        installationId: "installation-31",
        networkAddress: "203.0.113.9",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
