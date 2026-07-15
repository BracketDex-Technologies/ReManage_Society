import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import {
  createAuditEvent,
  type AuditEvent,
} from "../../../../../packages/security/src/index.ts";
import {
  RateLimitService,
  type RateLimitStore,
} from "../../security/rate-limit.service.ts";
import { createRateLimitStore } from "../../security/valkey-rate-limit-store.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import type { MobileSessionIssueDto } from "../session/dto/mobile-session.dto.ts";
import { MobileSessionService } from "../session/mobile-session.service.ts";
import type { PasswordLoginRequestDto } from "./dto/mobile-auth.dto.ts";
import { MobileIdentityRepository } from "./mobile-identity.repository.ts";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const DUMMY_PASSWORD_HASH =
  "$2b$10$.U5IqYUShZFvULzOxoBllOzA5WhIdRobuXNeISnFpVBJ9pkXcSbxe";

export const MOBILE_AUTH_AUDIT = Symbol("MOBILE_AUTH_AUDIT");
export const MOBILE_PASSWORD_RATE_LIMIT_STORE = Symbol(
  "MOBILE_PASSWORD_RATE_LIMIT_STORE",
);

export interface MobileAuthAudit {
  record(event: AuditEvent): Promise<void>;
}

export interface MobilePasswordRateLimitInput {
  identifierHash: string;
  installationId: string;
  networkAddress: string;
}

export interface MobilePasswordRateLimiter {
  checkOrThrow(input: MobilePasswordRateLimitInput): Promise<void>;
}

@Injectable()
export class MobilePasswordRateLimitService implements MobilePasswordRateLimiter {
  private readonly identifier: RateLimitService;
  private readonly installation: RateLimitService;
  private readonly network: RateLimitService;

  constructor(
    @Optional()
    @Inject(MOBILE_PASSWORD_RATE_LIMIT_STORE)
    store?: RateLimitStore,
  ) {
    const sharedStore = store ?? createRateLimitStore();
    this.identifier = new RateLimitService(sharedStore, {
      limit: 10,
      windowMs: RATE_LIMIT_WINDOW_MS,
      keyPrefix: "mobile-password-identifier",
    });
    this.installation = new RateLimitService(sharedStore, {
      limit: 20,
      windowMs: RATE_LIMIT_WINDOW_MS,
      keyPrefix: "mobile-password-installation",
    });
    this.network = new RateLimitService(sharedStore, {
      limit: 30,
      windowMs: RATE_LIMIT_WINDOW_MS,
      keyPrefix: "mobile-password-network",
    });
  }

  async checkOrThrow(input: MobilePasswordRateLimitInput): Promise<void> {
    const decisions = await Promise.all([
      this.identifier.check("mobile", input.identifierHash, "password-attempt"),
      this.installation.check("mobile", input.installationId, "password-attempt"),
      this.network.check("mobile", input.networkAddress, "password-attempt"),
    ]);
    if (decisions.some((decision) => !decision.allowed)) {
      throw new HttpException(
        { error: "rate_limit_exceeded" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

export interface MobilePasswordLoginContext {
  networkAddress: string;
  requestId: string;
}

@Injectable()
export class MobileAuthService {
  constructor(
    private readonly config: MobileConfigService,
    @Inject(MobileIdentityRepository)
    private readonly identities: Pick<
      MobileIdentityRepository,
      "findApprovedByEmail"
    >,
    @Inject(MobileSessionService)
    private readonly sessions: Pick<MobileSessionService, "issueForIdentity">,
    @Inject(MOBILE_AUTH_AUDIT)
    private readonly audit: MobileAuthAudit,
    @Inject(MobilePasswordRateLimitService)
    private readonly rateLimiter: MobilePasswordRateLimiter,
  ) {}

  async passwordLogin(
    body: PasswordLoginRequestDto,
    context: MobilePasswordLoginContext,
  ): Promise<MobileSessionIssueDto> {
    if (!this.config.value.enabled) {
      throw new ServiceUnavailableException({ error: "mobile_api_disabled" });
    }

    const normalizedIdentifier = body.identifier.trim().toLowerCase();
    const identifierHash = createHash("sha256")
      .update(normalizedIdentifier, "utf8")
      .digest("hex");
    await this.rateLimiter.checkOrThrow({
      identifierHash,
      installationId: body.installation.id,
      networkAddress: context.networkAddress,
    });

    const identity = await this.identities.findApprovedByEmail(body.identifier);
    const passwordMatches = await compare(
      body.password,
      identity?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!identity || !passwordMatches) {
      await this.audit.record(
        createAuditEvent({
          actorId: "anonymous",
          societyId: this.config.value.betaSocietyId,
          action: "tenant:membership.read",
          targetType: "mobile_auth",
          targetId: "mobile_password_login",
          outcome: "denied",
          requestId: context.requestId,
          metadata: {
            method: "password",
            installationId: body.installation.id,
          },
        }),
      );
      throw new UnauthorizedException({ error: "invalid_credentials" });
    }

    const issued = await this.sessions.issueForIdentity(identity, body.installation);
    await this.audit.record(
      createAuditEvent({
        actorId: identity.userId,
        societyId: identity.societyId,
        action: "tenant:membership.read",
        targetType: "mobile_auth",
        targetId: identity.userId,
        outcome: "allowed",
        requestId: context.requestId,
        metadata: {
          method: "password",
          installationId: body.installation.id,
        },
      }),
    );
    return issued;
  }
}
