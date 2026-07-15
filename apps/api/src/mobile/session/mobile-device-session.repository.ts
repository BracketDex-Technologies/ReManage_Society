import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "../../../../../packages/db/src/index.ts";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import type { MobileRole } from "../common/mobile-role.ts";

export interface CreateMobileSessionInput {
  userId: string;
  membershipId: string;
  societyId: string;
  installationId: string;
  platform: "android" | "ios";
  appVersion: string;
  deviceName?: string;
  activeRole: MobileRole;
  activePermissionRole: string;
}

export interface IssuedRenewableCredential {
  sessionId: string;
  credential: string;
  expiresAt: Date;
  version: number;
}

interface MobileDeviceSessionRecord {
  id: string;
  userId: string;
  membershipId: string;
  societyId: string;
  installationId: string;
  platform: string;
  appVersion: string;
  deviceName: string | null;
  activeRole: string;
  activePermissionRole: string;
  refreshFamilyId: string;
  refreshTokenHash: string;
  refreshRotation: number;
  version: number;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MobileDeviceSessionTransactionClient {
  mobileDeviceSession: {
    findFirst(input: unknown): Promise<MobileDeviceSessionRecord | null>;
    findUnique(input: unknown): Promise<MobileDeviceSessionRecord | null>;
    create(input: unknown): Promise<MobileDeviceSessionRecord>;
    update(input: unknown): Promise<MobileDeviceSessionRecord>;
    updateMany(input: unknown): Promise<{ count: number }>;
  };
}

export interface MobileDeviceSessionPersistenceClient
  extends MobileDeviceSessionTransactionClient {
  $transaction<T>(
    callback: (transaction: MobileDeviceSessionTransactionClient) => Promise<T>,
    options?: { isolationLevel: "Serializable" },
  ): Promise<T>;
}

export type MobileSessionCredentialErrorCode =
  | "invalid_credential"
  | "session_expired"
  | "session_revoked"
  | "refresh_reuse_detected";

export class MobileSessionCredentialError extends Error {
  constructor(readonly code: MobileSessionCredentialErrorCode) {
    super(code);
    this.name = "MobileSessionCredentialError";
  }
}

interface ParsedRenewableCredential {
  sessionId: string;
  secret: string;
}

type CredentialOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: MobileSessionCredentialErrorCode };

@Injectable()
export class MobileDeviceSessionRepository {
  constructor(
    private readonly client: MobileDeviceSessionPersistenceClient =
      prisma as unknown as MobileDeviceSessionPersistenceClient,
    private readonly config: MobileConfigService = new MobileConfigService(),
  ) {}

  async createSession(
    input: CreateMobileSessionInput,
  ): Promise<IssuedRenewableCredential> {
    const now = new Date();
    const sessionId = randomUUID();
    const refreshFamilyId = randomUUID();
    const secret = this.newSecret();
    const expiresAt = new Date(
      now.getTime() + this.config.value.renewableTtlDays * 24 * 60 * 60 * 1_000,
    );

    await this.serializableTransaction(async (transaction) => {
      await transaction.mobileDeviceSession.updateMany({
        where: {
          userId: input.userId,
          societyId: input.societyId,
          installationId: input.installationId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: "replaced_by_new_login",
        },
      });

      await transaction.mobileDeviceSession.create({
        data: {
          id: sessionId,
          userId: input.userId,
          membershipId: input.membershipId,
          societyId: input.societyId,
          installationId: input.installationId,
          platform: input.platform,
          appVersion: input.appVersion,
          deviceName: input.deviceName ?? null,
          activeRole: input.activeRole,
          activePermissionRole: input.activePermissionRole,
          refreshFamilyId,
          refreshTokenHash: this.hash(sessionId, secret),
          refreshRotation: 0,
          version: 1,
          expiresAt,
          revokedAt: null,
          revokeReason: null,
          lastSeenAt: now,
        },
      });
    });

    return {
      sessionId,
      credential: `${sessionId}.${secret}`,
      expiresAt,
      version: 1,
    };
  }

  async rotate(credential: string): Promise<IssuedRenewableCredential> {
    const parsed = this.parse(credential);
    const now = new Date();

    const result = await this.client.$transaction(async (transaction) => {
      const session = await transaction.mobileDeviceSession.findUnique({
        where: { id: parsed.sessionId },
      });
      if (!session) return this.failure("invalid_credential");
      const unavailable = this.unavailableSession(session, now);
      if (unavailable) return unavailable;

      if (!this.matches(session.refreshTokenHash, parsed)) {
        await this.markRefreshReuse(transaction, session.id, now);
        return this.failure("refresh_reuse_detected");
      }

      const nextSecret = this.newSecret();
      const rotated = await transaction.mobileDeviceSession.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: session.refreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          refreshTokenHash: this.hash(session.id, nextSecret),
          refreshRotation: { increment: 1 },
          lastSeenAt: now,
        },
      });
      if (rotated.count !== 1) {
        return this.resolveFailedRotation(transaction, parsed, now);
      }

      return this.success({
        sessionId: session.id,
        credential: `${session.id}.${nextSecret}`,
        expiresAt: session.expiresAt,
        version: session.version,
      });
    });

    return this.unwrap(result);
  }

  async updateRole(
    sessionId: string,
    activeRole: MobileRole,
    activePermissionRole: string,
  ): Promise<{ version: number }> {
    const now = new Date();
    const result = await this.client.$transaction(async (transaction) => {
      const session = await transaction.mobileDeviceSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) return this.failure("invalid_credential");
      const unavailable = this.unavailableSession(session, now);
      if (unavailable) return unavailable;

      const updated = await transaction.mobileDeviceSession.updateMany({
        where: {
          id: session.id,
          version: session.version,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          activeRole,
          activePermissionRole,
          version: { increment: 1 },
          lastSeenAt: now,
        },
      });
      if (updated.count !== 1) {
        const current = await transaction.mobileDeviceSession.findUnique({
          where: { id: session.id },
        });
        if (!current) return this.failure("invalid_credential");
        const currentUnavailable = this.unavailableSession(current, now);
        if (currentUnavailable) return currentUnavailable;
        return this.failure("invalid_credential");
      }

      return this.success({ version: session.version + 1 });
    });

    return this.unwrap(result);
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    const now = new Date();
    await this.client.$transaction(async (transaction) => {
      const session = await transaction.mobileDeviceSession.findUnique({
        where: { id: sessionId },
      });
      if (!session || session.revokedAt) return;

      await transaction.mobileDeviceSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokeReason: reason,
        },
      });
    });
  }

  async logout(credential: string): Promise<void> {
    const parsed = this.parse(credential);
    const now = new Date();
    const result = await this.client.$transaction(async (transaction) => {
      const session = await transaction.mobileDeviceSession.findUnique({
        where: { id: parsed.sessionId },
      });
      if (!session) return this.failure("invalid_credential");
      if (session.revokedAt) return this.success(undefined);

      if (!this.matches(session.refreshTokenHash, parsed)) {
        await this.markRefreshReuse(transaction, session.id, now);
        return this.failure("refresh_reuse_detected");
      }

      const loggedOut = await transaction.mobileDeviceSession.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: session.refreshTokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: "logged_out",
        },
      });
      if (loggedOut.count === 1) return this.success(undefined);

      const current = await transaction.mobileDeviceSession.findUnique({
        where: { id: session.id },
      });
      if (!current) return this.failure("invalid_credential");
      if (current.revokedAt) return this.success(undefined);
      if (!this.matches(current.refreshTokenHash, parsed)) {
        await this.markRefreshReuse(transaction, current.id, now);
        return this.failure("refresh_reuse_detected");
      }
      return this.failure("invalid_credential");
    });

    this.unwrap(result);
  }

  private unavailableSession(
    session: MobileDeviceSessionRecord,
    now: Date,
  ): CredentialOperationResult<never> | null {
    if (session.revokedAt) return this.failure("session_revoked");
    if (session.expiresAt.getTime() <= now.getTime()) {
      return this.failure("session_expired");
    }
    return null;
  }

  private async resolveFailedRotation(
    transaction: MobileDeviceSessionTransactionClient,
    credential: ParsedRenewableCredential,
    now: Date,
  ): Promise<CredentialOperationResult<never>> {
    const current = await transaction.mobileDeviceSession.findUnique({
      where: { id: credential.sessionId },
    });
    if (!current) return this.failure("invalid_credential");
    const unavailable = this.unavailableSession(current, now);
    if (unavailable) return unavailable;

    if (!this.matches(current.refreshTokenHash, credential)) {
      await this.markRefreshReuse(transaction, current.id, now);
      return this.failure("refresh_reuse_detected");
    }
    return this.failure("invalid_credential");
  }

  private async markRefreshReuse(
    transaction: MobileDeviceSessionTransactionClient,
    sessionId: string,
    now: Date,
  ): Promise<void> {
    await transaction.mobileDeviceSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: {
        revokedAt: now,
        revokeReason: "refresh_reuse_detected",
      },
    });
  }

  private async serializableTransaction<T>(
    callback: (transaction: MobileDeviceSessionTransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.client.$transaction(callback, {
          isolationLevel: "Serializable",
        });
      } catch (error) {
        if (!isRetryableCreateSessionConflict(error) || attempt === maxAttempts) {
          throw error;
        }
      }
    }
    throw new Error("Serializable transaction retry limit reached");
  }

  private newSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  private hash(sessionId: string, secret: string): string {
    return createHmac("sha256", this.config.value.refreshTokenPepper)
      .update(`${sessionId}:${secret}`, "utf8")
      .digest("hex");
  }

  private matches(
    storedHash: string,
    credential: ParsedRenewableCredential,
  ): boolean {
    const expected = Buffer.from(storedHash, "hex");
    const presented = Buffer.from(
      this.hash(credential.sessionId, credential.secret),
      "hex",
    );
    return expected.length === presented.length && timingSafeEqual(expected, presented);
  }

  private parse(credential: string): ParsedRenewableCredential {
    const parts = credential.split(".");
    if (parts.length !== 2 || !parts[0] || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) {
      throw new MobileSessionCredentialError("invalid_credential");
    }

    const secretBytes = Buffer.from(parts[1], "base64url");
    if (secretBytes.length !== 32 || secretBytes.toString("base64url") !== parts[1]) {
      throw new MobileSessionCredentialError("invalid_credential");
    }

    return { sessionId: parts[0], secret: parts[1] };
  }

  private success<T>(value: T): CredentialOperationResult<T> {
    return { ok: true, value };
  }

  private failure(code: MobileSessionCredentialErrorCode): CredentialOperationResult<never> {
    return { ok: false, code };
  }

  private unwrap<T>(result: CredentialOperationResult<T>): T {
    if (!result.ok) throw new MobileSessionCredentialError(result.code);
    return result.value;
  }
}

function isRetryableCreateSessionConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const prismaError = error as {
    code?: unknown;
    meta?: { modelName?: unknown; target?: unknown };
  };
  if (prismaError.code === "P2034") return true;
  if (prismaError.code !== "P2002") return false;

  const target = prismaError.meta?.target;
  if (target === "MobileDeviceSession_one_active_installation_idx") return true;

  return (
    prismaError.meta?.modelName === "MobileDeviceSession" &&
    Array.isArray(target) &&
    target.length === 3 &&
    target[0] === "userId" &&
    target[1] === "societyId" &&
    target[2] === "installationId"
  );
}
