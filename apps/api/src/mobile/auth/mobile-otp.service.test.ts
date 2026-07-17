import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Logger } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { RateLimitStore } from "../../security/rate-limit.service.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import type { MobileSessionIssueDto } from "../session/dto/mobile-session.dto.ts";
import type {
  OtpRequestDto,
  OtpVerifyDto,
} from "./dto/mobile-auth.dto.ts";
import { MobileAuthController } from "./mobile-auth.controller.ts";
import type { MobileAuthService } from "./mobile-auth.service.ts";
import type { MobileIdentity } from "./mobile-identity.repository.ts";
import type { MobileOtpDelivery } from "./mobile-otp-delivery.ts";
import {
  MobileOtpRateLimitService,
  MobileOtpService,
  type MobileOtpChallengeCreateInput,
  type MobileOtpChallengeRecord,
  type MobileOtpChallengeStore,
  type MobileOtpRateLimiter,
} from "./mobile-otp.service.ts";
import { SmtpMobileOtpDeliveryService } from "./smtp-mobile-otp-delivery.service.ts";

const NOW = new Date("2026-07-17T08:00:00.000Z");
const EMAIL = "resident@example.com";
const CODE = "000123";
const PASSWORD = "password-must-never-be-logged";
const ACCESS_TOKEN = "access-token-must-never-be-logged";
const RENEWABLE_CREDENTIAL = "renewable-credential-must-never-be-logged";
const SMTP_URL = "smtp://user:secret@smtp.example.com:587";
const MESSAGE_PAYLOAD = "raw-message-payload-must-never-be-logged";
const INSTALLATION = {
  id: "11111111-1111-4111-8111-111111111111",
  platform: "android" as const,
  appVersion: "1.0.0",
  deviceName: "Pixel 9",
};
const ISSUE: MobileSessionIssueDto = {
  accessToken: ACCESS_TOKEN,
  accessExpiresAt: "2026-07-17T08:10:00.000Z",
  renewableCredential: RENEWABLE_CREDENTIAL,
  renewableExpiresAt: "2026-08-16T08:00:00.000Z",
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

function requestBody(identifier = `  ${EMAIL.toUpperCase()}  `): OtpRequestDto {
  return { identifier, installation: INSTALLATION };
}

function approvedIdentity(): MobileIdentity {
  return {
    userId: "user_1",
    name: "Resident One",
    email: EMAIL,
    passwordHash: "password-hash",
    societyId: "society_beta",
    societyName: "Beta Society",
    membershipId: "membership_1",
    flatId: "flat_1",
    roles: [{ role: "resident", permissionRole: "member" }],
  };
}

class FakeChallengeStore implements MobileOtpChallengeStore {
  readonly created: MobileOtpChallengeCreateInput[] = [];
  readonly records = new Map<string, MobileOtpChallengeRecord>();
  readonly userEmails = new Map<string, string>([["user_1", EMAIL]]);

  async create(input: MobileOtpChallengeCreateInput): Promise<void> {
    this.created.push(input);
    this.records.set(input.id, {
      ...input,
      attempts: 0,
      consumedAt: null,
      identifier: this.userEmails.get(input.userId) ?? EMAIL,
    });
  }

  async findById(challengeId: string): Promise<MobileOtpChallengeRecord | null> {
    return this.records.get(challengeId) ?? null;
  }

  async incrementAttempts(
    challengeId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<boolean> {
    const record = this.records.get(challengeId);
    if (
      !record ||
      record.consumedAt ||
      record.expiresAt <= now ||
      record.attempts >= maxAttempts
    ) {
      return false;
    }
    record.attempts += 1;
    return true;
  }

  async consume(
    challengeId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<boolean> {
    const record = this.records.get(challengeId);
    if (
      !record ||
      record.consumedAt ||
      record.expiresAt <= now ||
      record.attempts >= maxAttempts
    ) {
      return false;
    }
    record.consumedAt = now;
    return true;
  }
}

class FakeDelivery implements MobileOtpDelivery {
  readonly messages: Parameters<MobileOtpDelivery["sendLoginCode"]>[0][] = [];
  failure?: Error;

  async sendLoginCode(
    input: Parameters<MobileOtpDelivery["sendLoginCode"]>[0],
  ): Promise<void> {
    this.messages.push(input);
    if (this.failure) throw this.failure;
  }
}

class FakeRateLimiter implements MobileOtpRateLimiter {
  readonly requestCalls: unknown[] = [];
  readonly verifyCalls: unknown[] = [];

  async checkRequestOrThrow(input: unknown): Promise<void> {
    this.requestCalls.push(input);
  }

  async checkVerifyOrThrow(input: unknown): Promise<void> {
    this.verifyCalls.push(input);
  }
}

function createHarness(identity: MobileIdentity | null = approvedIdentity()) {
  const store = new FakeChallengeStore();
  const delivery = new FakeDelivery();
  const limiter = new FakeRateLimiter();
  const identityCalls: string[] = [];
  const sessionCalls: unknown[] = [];
  const service = new MobileOtpService(
    createConfig(),
    {
      findApprovedByEmail: async (identifier: string) => {
        identityCalls.push(identifier);
        return identity;
      },
    },
    store,
    {
      issueForIdentity: async (
        foundIdentity: MobileIdentity,
        installation: OtpVerifyDto["installation"],
      ) => {
        sessionCalls.push({ identity: foundIdentity, installation });
        return ISSUE;
      },
    },
    delivery,
    limiter,
    () => new Date(NOW),
    () => 123,
  );
  return {
    delivery,
    identityCalls,
    limiter,
    service,
    sessionCalls,
    store,
  };
}

async function requestKnownChallenge(harness = createHarness()) {
  const response = await harness.service.requestOtp(requestBody(), {
    networkAddress: "203.0.113.9",
    requestId: "request_1",
  });
  return { ...harness, response };
}

async function expectOtpDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    response: { error: "invalid_or_expired_otp" },
    status: 401,
  });
}

describe("MobileOtpService request", () => {
  it("returns the same accepted response keys and HTTP status for known and unknown emails", async () => {
    const known = createHarness();
    const unknown = createHarness(null);

    const [knownResponse, unknownResponse] = await Promise.all([
      known.service.requestOtp(requestBody(), {
        networkAddress: "203.0.113.9",
        requestId: "request_known",
      }),
      unknown.service.requestOtp(requestBody("unknown@example.com"), {
        networkAddress: "203.0.113.10",
        requestId: "request_unknown",
      }),
    ]);

    expect(knownResponse.accepted).toBe(true);
    expect(unknownResponse.accepted).toBe(true);
    expect(Object.keys(knownResponse).sort()).toEqual(["accepted", "challengeId"]);
    expect(Object.keys(unknownResponse).sort()).toEqual(["accepted", "challengeId"]);
    expect(knownResponse.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(unknownResponse.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        MobileAuthController.prototype.requestOtp,
      ),
    ).toBe(202);
  });

  it("creates no challenge and sends no message for an unknown email", async () => {
    const { delivery, identityCalls, service, store } = createHarness(null);

    await expect(
      service.requestOtp(requestBody(" Unknown@Example.com "), {
        networkAddress: "203.0.113.9",
        requestId: "request_unknown",
      }),
    ).resolves.toMatchObject({ accepted: true });

    expect(identityCalls).toEqual([" Unknown@Example.com "]);
    expect(store.created).toHaveLength(0);
    expect(delivery.messages).toHaveLength(0);
  });

  it("stores only HMAC identifier and code hashes and delivers a six-digit code expiring in five minutes", async () => {
    const { delivery, limiter, response, store } = await requestKnownChallenge();
    const pepper = createConfig().value.otpPepper;
    const identifierHash = createHmac("sha256", pepper)
      .update(EMAIL, "utf8")
      .digest("hex");
    const codeHash = createHmac("sha256", pepper)
      .update(`${response.challengeId}:${CODE}`, "utf8")
      .digest("hex");

    expect(store.created).toEqual([
      {
        id: response.challengeId,
        userId: "user_1",
        societyId: "society_beta",
        installationId: INSTALLATION.id,
        identifierHash,
        codeHash,
        expiresAt: new Date("2026-07-17T08:05:00.000Z"),
      },
    ]);
    expect(JSON.stringify(store.created)).not.toContain(EMAIL);
    expect(JSON.stringify(store.created)).not.toContain(CODE);
    expect(delivery.messages).toEqual([
      {
        recipientEmail: EMAIL,
        recipientName: "Resident One",
        code: CODE,
        expiresInMinutes: 5,
      },
    ]);
    expect(delivery.messages[0]?.code).toMatch(/^\d{6}$/);
    expect(limiter.requestCalls).toEqual([
      {
        identifierHash,
        installationId: INSTALLATION.id,
        networkAddress: "203.0.113.9",
      },
    ]);
  });

  it("keeps SMTP failure publicly indistinguishable and records only a fixed redacted warning", async () => {
    const warning = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const logging = [
      vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined),
      warning,
      vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined),
      vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined),
      vi.spyOn(Logger.prototype, "verbose").mockImplementation(() => undefined),
    ];
    const known = createHarness();
    const unknown = createHarness(null);
    known.delivery.failure = new Error(
      `SMTP failed at ${SMTP_URL} for ${EMAIL} code ${CODE} hash secret ${PASSWORD} ${ACCESS_TOKEN} ${RENEWABLE_CREDENTIAL} ${MESSAGE_PAYLOAD}`,
    );

    try {
      const [knownResponse, unknownResponse] = await Promise.all([
        known.service.requestOtp(requestBody(), {
          networkAddress: "203.0.113.9",
          requestId: "request_delivery_failure",
        }),
        unknown.service.requestOtp(requestBody("unknown@example.com"), {
          networkAddress: "203.0.113.10",
          requestId: "request_unknown",
        }),
      ]);

      expect(knownResponse.accepted).toBe(true);
      expect(unknownResponse.accepted).toBe(true);
      expect(Object.keys(knownResponse).sort()).toEqual(
        Object.keys(unknownResponse).sort(),
      );
      expect(warning.mock.calls).toEqual([["Mobile OTP delivery failed"]]);
      const capturedLogs = JSON.stringify(logging.flatMap((spy) => spy.mock.calls));
      for (const secret of [
        EMAIL,
        CODE,
        storeCodeHash(known.store),
        PASSWORD,
        ACCESS_TOKEN,
        RENEWABLE_CREDENTIAL,
        SMTP_URL,
        MESSAGE_PAYLOAD,
      ]) {
        expect(capturedLogs).not.toContain(secret);
      }
    } finally {
      for (const spy of logging) spy.mockRestore();
    }
  });
});

describe("MobileOtpService verification", () => {
  it("increments five wrong-code attempts and rejects the sixth without comparing a code", async () => {
    const harness = await requestKnownChallenge();
    const verify = (code: string) =>
      harness.service.verifyOtp({
        challengeId: harness.response.challengeId,
        code,
        installation: INSTALLATION,
      });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectOtpDenied(verify("999999"));
    }
    const record = harness.store.records.get(harness.response.challengeId);
    expect(record?.attempts).toBe(5);

    if (!record) throw new Error("Expected challenge record");
    Object.defineProperty(record, "codeHash", {
      get: () => {
        throw new Error("Code hash must not be read after five attempts");
      },
    });
    await expectOtpDenied(verify(CODE));
    expect(record.attempts).toBe(5);
    expect(harness.sessionCalls).toHaveLength(0);
  });

  it.each(["expired", "consumed"] as const)(
    "rejects an %s challenge without issuing a session",
    async (state) => {
      const harness = await requestKnownChallenge();
      const record = harness.store.records.get(harness.response.challengeId);
      if (!record) throw new Error("Expected challenge record");
      if (state === "expired") {
        record.expiresAt = new Date(NOW.getTime() - 1);
      } else {
        record.consumedAt = new Date(NOW.getTime() - 1);
      }
      Object.defineProperty(record, "codeHash", {
        get: () => {
          throw new Error("Code hash must not be read for an inactive challenge");
        },
      });

      await expectOtpDenied(
        harness.service.verifyOtp({
          challengeId: harness.response.challengeId,
          code: CODE,
          installation: INSTALLATION,
        }),
      );
      expect(harness.sessionCalls).toHaveLength(0);
    },
  );

  it("atomically consumes a correct challenge and issues a device session exactly once", async () => {
    const harness = await requestKnownChallenge();
    const body: OtpVerifyDto = {
      challengeId: harness.response.challengeId,
      code: CODE,
      installation: INSTALLATION,
    };

    await expect(harness.service.verifyOtp(body)).resolves.toEqual(ISSUE);
    await expectOtpDenied(harness.service.verifyOtp(body));

    expect(
      harness.store.records.get(harness.response.challengeId)?.consumedAt,
    ).toEqual(NOW);
    expect(harness.sessionCalls).toEqual([
      { identity: approvedIdentity(), installation: INSTALLATION },
    ]);
    expect(harness.limiter.verifyCalls).toEqual([
      { installationId: INSTALLATION.id },
      { installationId: INSTALLATION.id },
    ]);
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

describe("MobileOtpRateLimitService", () => {
  it("enforces five OTP requests per identifier independently", async () => {
    const limiter = new MobileOtpRateLimitService(new RecordingStore());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        limiter.checkRequestOrThrow({
          identifierHash: "identifier-shared",
          installationId: `installation-${attempt}`,
          networkAddress: `203.0.113.${attempt}`,
        }),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.checkRequestOrThrow({
        identifierHash: "identifier-shared",
        installationId: "installation-6",
        networkAddress: "203.0.113.6",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("enforces ten OTP requests per installation independently", async () => {
    const limiter = new MobileOtpRateLimitService(new RecordingStore());
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        limiter.checkRequestOrThrow({
          identifierHash: `identifier-${attempt}`,
          installationId: "installation-shared",
          networkAddress: `203.0.113.${attempt}`,
        }),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.checkRequestOrThrow({
        identifierHash: "identifier-11",
        installationId: "installation-shared",
        networkAddress: "203.0.113.11",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("enforces twenty OTP requests per network address independently", async () => {
    const limiter = new MobileOtpRateLimitService(new RecordingStore());
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(
        limiter.checkRequestOrThrow({
          identifierHash: `identifier-${attempt}`,
          installationId: `installation-${attempt}`,
          networkAddress: "203.0.113.9",
        }),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.checkRequestOrThrow({
        identifierHash: "identifier-21",
        installationId: "installation-21",
        networkAddress: "203.0.113.9",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("enforces thirty verification requests per installation independently", async () => {
    const limiter = new MobileOtpRateLimitService(new RecordingStore());
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await expect(
        limiter.checkVerifyOrThrow({ installationId: "installation-shared" }),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.checkVerifyOrThrow({ installationId: "installation-shared" }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe("SmtpMobileOtpDeliveryService", () => {
  it("uses SMTP_URL and EMAIL_FROM with the fixed subject and five-minute plain text", async () => {
    const sent: unknown[] = [];
    const factoryCalls: string[] = [];
    const service = new SmtpMobileOtpDeliveryService(
      {
        SMTP_URL,
        EMAIL_FROM: "ReManage <login@example.com>",
      },
      (url) => {
        factoryCalls.push(url);
        return {
          sendMail: async (message) => {
            sent.push(message);
          },
        };
      },
    );

    await service.sendLoginCode({
      recipientEmail: EMAIL,
      recipientName: "Resident One",
      code: CODE,
      expiresInMinutes: 5,
    });

    expect(factoryCalls).toEqual([SMTP_URL]);
    expect(sent).toEqual([
      {
        from: "ReManage <login@example.com>",
        to: EMAIL,
        subject: "Your ReManage login code",
        text: expect.stringMatching(/000123.*expires in five minutes/is),
      },
    ]);
  });
});

describe("MobileAuthController OTP routes", () => {
  it("forwards server-derived request context and returns the accepted response", async () => {
    const calls: unknown[] = [];
    const otp = {
      requestOtp: async (body: OtpRequestDto, context: unknown) => {
        calls.push({ body, context });
        return { accepted: true as const, challengeId: "challenge_1" };
      },
    };
    const controller = new MobileAuthController({} as MobileAuthService);
    (controller as unknown as { otp: typeof otp }).otp = otp;

    await expect(
      controller.requestOtp(
        {
          id: "fastify-request-id",
          ip: "203.0.113.9",
          headers: { "x-request-id": "client-controlled-request-id" },
        } as never,
        requestBody(),
      ),
    ).resolves.toEqual({ accepted: true, challengeId: "challenge_1" });
    expect(calls).toEqual([
      {
        body: requestBody(),
        context: {
          networkAddress: "203.0.113.9",
          requestId: "fastify-request-id",
        },
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain("client-controlled-request-id");
  });

  it("declares the verification route as HTTP 200", () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        MobileAuthController.prototype.verifyOtp,
      ),
    ).toBe(200);
  });
});

function storeCodeHash(store: FakeChallengeStore): string {
  return store.created[0]?.codeHash ?? "missing-code-hash";
}
