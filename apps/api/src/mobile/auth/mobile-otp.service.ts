import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  RateLimitService,
  type RateLimitStore,
} from "../../security/rate-limit.service.ts";
import { createRateLimitStore } from "../../security/valkey-rate-limit-store.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import type { MobileSessionIssueDto } from "../session/dto/mobile-session.dto.ts";
import { MobileSessionService } from "../session/mobile-session.service.ts";
import type {
  OtpRequestAcceptedDto,
  OtpRequestDto,
  OtpVerifyDto,
} from "./dto/mobile-auth.dto.ts";
import {
  MOBILE_OTP_DELIVERY,
  type MobileOtpDelivery,
} from "./mobile-otp-delivery.ts";
import {
  MobileIdentityRepository,
  type MobileIdentity,
} from "./mobile-identity.repository.ts";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const HASH_BYTES = 32;
const RESPONSE_FLOOR_MS = 300;
const RESPONSE_JITTER_MAX_MS = 100;

export const MOBILE_OTP_CHALLENGE_CLIENT = Symbol(
  "MOBILE_OTP_CHALLENGE_CLIENT",
);
export const MOBILE_OTP_RATE_LIMIT_STORE = Symbol(
  "MOBILE_OTP_RATE_LIMIT_STORE",
);
export const MOBILE_OTP_CLOCK = Symbol("MOBILE_OTP_CLOCK");
export const MOBILE_OTP_CODE_GENERATOR = Symbol("MOBILE_OTP_CODE_GENERATOR");
export const MOBILE_OTP_RESPONSE_DELAY = Symbol("MOBILE_OTP_RESPONSE_DELAY");
export const MOBILE_OTP_RESPONSE_JITTER = Symbol("MOBILE_OTP_RESPONSE_JITTER");

export type MobileOtpClock = () => Date;
export type MobileOtpCodeGenerator = () => number;
export type MobileOtpResponseDelay = (milliseconds: number) => Promise<void>;
export type MobileOtpResponseJitter = () => number;

export interface MobileOtpChallengeCreateInput {
  id: string;
  userId: string;
  societyId: string;
  installationId: string;
  identifierHash: string;
  codeHash: string;
  expiresAt: Date;
}

export interface MobileOtpChallengeRecord
  extends MobileOtpChallengeCreateInput {
  attempts: number;
  consumedAt: Date | null;
  identifier: string;
}

export interface MobileOtpChallengeStore {
  create(input: MobileOtpChallengeCreateInput): Promise<void>;
  findById(challengeId: string): Promise<MobileOtpChallengeRecord | null>;
  incrementAttempts(
    challengeId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<boolean>;
  consume(
    challengeId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<boolean>;
}

interface MobileOtpChallengePersistenceRecord
  extends MobileOtpChallengeCreateInput {
  attempts: number;
  consumedAt: Date | null;
  user: { email: string };
}

export interface MobileOtpChallengePersistenceClient {
  mobileOtpChallenge: {
    create(input: unknown): Promise<unknown>;
    findUnique(input: unknown): Promise<MobileOtpChallengePersistenceRecord | null>;
    updateMany(input: unknown): Promise<{ count: number }>;
  };
}

@Injectable()
export class MobileOtpChallengeRepository implements MobileOtpChallengeStore {
  constructor(
    @Inject(MOBILE_OTP_CHALLENGE_CLIENT)
    private readonly client: MobileOtpChallengePersistenceClient,
  ) {}

  async create(input: MobileOtpChallengeCreateInput): Promise<void> {
    await this.client.mobileOtpChallenge.create({ data: input });
  }

  async findById(challengeId: string): Promise<MobileOtpChallengeRecord | null> {
    const record = await this.client.mobileOtpChallenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        userId: true,
        societyId: true,
        installationId: true,
        identifierHash: true,
        codeHash: true,
        attempts: true,
        expiresAt: true,
        consumedAt: true,
        user: { select: { email: true } },
      },
    });
    if (!record) return null;
    const { user, ...challenge } = record;
    return { ...challenge, identifier: user.email };
  }

  async incrementAttempts(
    challengeId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<boolean> {
    const result = await this.client.mobileOtpChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });
    return result.count === 1;
  }

  async consume(
    challengeId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<boolean> {
    const result = await this.client.mobileOtpChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
      },
      data: { consumedAt: now },
    });
    return result.count === 1;
  }
}

export interface MobileOtpRequestRateLimitInput {
  identifierHash: string;
  installationId: string;
  networkAddress: string;
}

export interface MobileOtpVerifyRateLimitInput {
  installationId: string;
}

export interface MobileOtpRateLimiter {
  checkRequestOrThrow(input: MobileOtpRequestRateLimitInput): Promise<void>;
  checkVerifyOrThrow(input: MobileOtpVerifyRateLimitInput): Promise<void>;
}

@Injectable()
export class MobileOtpRateLimitService implements MobileOtpRateLimiter {
  private readonly requestIdentifier: RateLimitService;
  private readonly requestInstallation: RateLimitService;
  private readonly requestNetwork: RateLimitService;
  private readonly verifyInstallation: RateLimitService;

  constructor(
    @Optional()
    @Inject(MOBILE_OTP_RATE_LIMIT_STORE)
    store?: RateLimitStore,
  ) {
    const sharedStore = store ?? createRateLimitStore();
    this.requestIdentifier = new RateLimitService(sharedStore, {
      limit: 5,
      windowMs: RATE_LIMIT_WINDOW_MS,
      keyPrefix: "mobile-otp-request-identifier",
    });
    this.requestInstallation = new RateLimitService(sharedStore, {
      limit: 10,
      windowMs: RATE_LIMIT_WINDOW_MS,
      keyPrefix: "mobile-otp-request-installation",
    });
    this.requestNetwork = new RateLimitService(sharedStore, {
      limit: 20,
      windowMs: RATE_LIMIT_WINDOW_MS,
      keyPrefix: "mobile-otp-request-network",
    });
    this.verifyInstallation = new RateLimitService(sharedStore, {
      limit: 30,
      windowMs: RATE_LIMIT_WINDOW_MS,
      keyPrefix: "mobile-otp-verify-installation",
    });
  }

  async checkRequestOrThrow(
    input: MobileOtpRequestRateLimitInput,
  ): Promise<void> {
    const decisions = await Promise.all([
      this.requestIdentifier.check(
        "mobile",
        input.identifierHash,
        "otp-request",
      ),
      this.requestInstallation.check(
        "mobile",
        input.installationId,
        "otp-request",
      ),
      this.requestNetwork.check(
        "mobile",
        input.networkAddress,
        "otp-request",
      ),
    ]);
    if (decisions.some((decision) => !decision.allowed)) {
      throw rateLimitExceeded();
    }
  }

  async checkVerifyOrThrow(input: MobileOtpVerifyRateLimitInput): Promise<void> {
    const decision = await this.verifyInstallation.check(
      "mobile",
      input.installationId,
      "otp-verify",
    );
    if (!decision.allowed) {
      throw rateLimitExceeded();
    }
  }
}

export interface MobileOtpRequestContext {
  networkAddress: string;
  requestId: string;
}

@Injectable()
export class MobileOtpService {
  private readonly logger = new Logger(MobileOtpService.name);

  constructor(
    @Inject(MobileConfigService)
    private readonly config: MobileConfigService,
    @Inject(MobileIdentityRepository)
    private readonly identities: Pick<
      MobileIdentityRepository,
      "findApprovedByEmail"
    >,
    @Inject(MobileOtpChallengeRepository)
    private readonly challenges: MobileOtpChallengeStore,
    @Inject(MobileSessionService)
    private readonly sessions: Pick<MobileSessionService, "issueForIdentity">,
    @Inject(MOBILE_OTP_DELIVERY)
    private readonly delivery: MobileOtpDelivery,
    @Inject(MobileOtpRateLimitService)
    private readonly rateLimiter: MobileOtpRateLimiter,
    @Inject(MOBILE_OTP_CLOCK)
    private readonly clock: MobileOtpClock,
    @Inject(MOBILE_OTP_CODE_GENERATOR)
    private readonly codeGenerator: MobileOtpCodeGenerator,
    @Inject(MOBILE_OTP_RESPONSE_DELAY)
    private readonly responseDelay: MobileOtpResponseDelay,
    @Inject(MOBILE_OTP_RESPONSE_JITTER)
    private readonly responseJitter: MobileOtpResponseJitter,
  ) {}

  async requestOtp(
    body: OtpRequestDto,
    context: MobileOtpRequestContext,
  ): Promise<OtpRequestAcceptedDto> {
    this.assertEnabled();
    const startedAt = this.clock();
    const identifierHash = this.hmac(body.identifier.trim().toLowerCase());
    await this.rateLimiter.checkRequestOrThrow({
      identifierHash,
      installationId: body.installation.id,
      networkAddress: context.networkAddress,
    });

    const challengeId = randomUUID();
    const accepted: OtpRequestAcceptedDto = { accepted: true, challengeId };
    const identity = await this.identities.findApprovedByEmail(body.identifier);
    if (identity) {
      const code = String(this.codeGenerator()).padStart(6, "0");
      const now = this.clock();
      let challengePersisted = false;
      try {
        await this.challenges.create({
          id: challengeId,
          userId: identity.userId,
          societyId: identity.societyId,
          installationId: body.installation.id,
          identifierHash,
          codeHash: this.hmac(`${challengeId}:${code}`),
          expiresAt: new Date(
            now.getTime() + this.config.value.otpTtlSeconds * 1_000,
          ),
        });
        challengePersisted = true;
      } catch {
        this.logger.warn("Mobile OTP challenge persistence failed", {
          requestId: context.requestId,
        });
      }

      if (challengePersisted) {
        this.startDelivery(identity, code, context.requestId);
      }
    }

    await this.waitForResponseFloor(startedAt);
    return accepted;
  }

  async verifyOtp(body: OtpVerifyDto): Promise<MobileSessionIssueDto> {
    this.assertEnabled();
    await this.rateLimiter.checkVerifyOrThrow({
      installationId: body.installation.id,
    });

    const now = this.clock();
    const challenge = await this.challenges.findById(body.challengeId);
    if (
      !challenge ||
      challenge.installationId !== body.installation.id ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      challenge.attempts >= this.config.value.otpMaxAttempts
    ) {
      throw otpDenied();
    }

    const candidateHash = this.hmac(`${challenge.id}:${body.code}`);
    if (!hashesMatch(challenge.codeHash, candidateHash)) {
      await this.challenges.incrementAttempts(
        challenge.id,
        now,
        this.config.value.otpMaxAttempts,
      );
      throw otpDenied();
    }

    const identity = await this.identities.findApprovedByEmail(
      challenge.identifier,
    );
    if (
      !identity ||
      identity.userId !== challenge.userId ||
      identity.societyId !== challenge.societyId
    ) {
      throw otpDenied();
    }
    const consumed = await this.challenges.consume(
      challenge.id,
      now,
      this.config.value.otpMaxAttempts,
    );
    if (!consumed) throw otpDenied();

    return this.sessions.issueForIdentity(identity, body.installation);
  }

  private hmac(value: string): string {
    return createHmac("sha256", this.config.value.otpPepper)
      .update(value, "utf8")
      .digest("hex");
  }

  private startDelivery(
    identity: MobileIdentity,
    code: string,
    requestId: string,
  ): void {
    try {
      void this.delivery
        .sendLoginCode({
          recipientEmail: identity.email,
          recipientName: identity.name,
          code,
          expiresInMinutes: 5,
        })
        .catch(() => {
          this.logger.warn("Mobile OTP delivery failed", { requestId });
        });
    } catch {
      this.logger.warn("Mobile OTP delivery failed", { requestId });
    }
  }

  private async waitForResponseFloor(startedAt: Date): Promise<void> {
    const elapsedMs = Math.max(this.clock().getTime() - startedAt.getTime(), 0);
    const jitterMs = Math.max(
      0,
      Math.min(RESPONSE_JITTER_MAX_MS, Math.trunc(this.responseJitter())),
    );
    await this.responseDelay(
      Math.max(RESPONSE_FLOOR_MS + jitterMs - elapsedMs, 0),
    );
  }

  private assertEnabled(): void {
    if (!this.config.value.enabled) {
      throw new ServiceUnavailableException({ error: "mobile_api_disabled" });
    }
  }
}

export function generateMobileOtpCode(): number {
  return randomInt(0, 1_000_000);
}

export function generateMobileOtpResponseJitter(): number {
  return randomInt(0, RESPONSE_JITTER_MAX_MS + 1);
}

export async function delayMobileOtpResponse(
  milliseconds: number,
): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function hashesMatch(storedHash: string, candidateHash: string): boolean {
  const stored = Buffer.from(storedHash, "hex");
  const candidate = Buffer.from(candidateHash, "hex");
  return (
    stored.length === HASH_BYTES &&
    candidate.length === HASH_BYTES &&
    timingSafeEqual(stored, candidate)
  );
}

function otpDenied(): UnauthorizedException {
  return new UnauthorizedException({ error: "invalid_or_expired_otp" });
}

function rateLimitExceeded(): HttpException {
  return new HttpException(
    { error: "rate_limit_exceeded" },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
