import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileConfigService } from "../common/mobile-config.service.ts";
import {
  MobileDeviceSessionRepository,
  type MobileDeviceSessionPersistenceClient,
} from "./mobile-device-session.repository.ts";

interface SessionRecord {
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

interface RepositoryOperation {
  action: "create" | "update" | "updateMany";
  input: unknown;
}

interface RepositoryTestClient extends MobileDeviceSessionPersistenceClient {
  sessions: SessionRecord[];
  operations: RepositoryOperation[];
  transactionCount: number;
}

const NOW = new Date("2026-07-14T12:00:00.000Z");

function createConfig() {
  return new MobileConfigService({
    MOBILE_API_ENABLED: "true",
    MOBILE_BETA_SOCIETY_ID: "society_a",
    MOBILE_ACCESS_TOKEN_SECRET: "mobile-access-secret-with-at-least-32-characters",
    MOBILE_REFRESH_TOKEN_PEPPER: "refresh-pepper-with-at-least-32-characters",
    MOBILE_OTP_PEPPER: "mobile-otp-pepper-with-at-least-32-characters",
  });
}

function matches(record: SessionRecord, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => {
    const current = record[key as keyof SessionRecord];
    if (typeof value === "object" && value !== null && "gt" in value) {
      return current instanceof Date && current > (value as { gt: Date }).gt;
    }
    return current === value;
  });
}

function applyData(record: SessionRecord, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "object" && value !== null && "increment" in value) {
      const increment = (value as { increment: number }).increment;
      (record as unknown as Record<string, unknown>)[key] =
        Number(record[key as keyof SessionRecord]) + increment;
    } else {
      (record as unknown as Record<string, unknown>)[key] = value;
    }
  }
  record.updatedAt = new Date();
  return record;
}

function createClient(
  options: {
    serializationFailures?: number;
    uniqueConflicts?: Array<Record<string, unknown>>;
  } = {},
): RepositoryTestClient {
  const sessions: SessionRecord[] = [];
  const operations: RepositoryOperation[] = [];
  let serializableTail = Promise.resolve();
  let serializationFailures = options.serializationFailures ?? 0;
  const uniqueConflicts = [...(options.uniqueConflicts ?? [])];
  const model = {
    findFirst: async (input: unknown) => {
      const where = (input as { where: Record<string, unknown> }).where;
      const session = [...sessions].reverse().find((candidate) => matches(candidate, where));
      return session ? { ...session } : null;
    },
    findUnique: async (input: unknown) => {
      const id = (input as { where: { id: string } }).where.id;
      const session = sessions.find((candidate) => candidate.id === id);
      return session ? { ...session } : null;
    },
    create: async (input: unknown) => {
      operations.push({ action: "create", input });
      const data = (input as { data: Omit<SessionRecord, "createdAt" | "updatedAt"> }).data;
      const record: SessionRecord = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessions.push(record);
      return record;
    },
    update: async (input: unknown) => {
      operations.push({ action: "update", input });
      const { where, data } = input as {
        where: { id: string };
        data: Record<string, unknown>;
      };
      const record = sessions.find((session) => session.id === where.id);
      if (!record) throw new Error(`Unknown session ${where.id}`);
      return applyData(record, data);
    },
    updateMany: async (input: unknown) => {
      operations.push({ action: "updateMany", input });
      const { where, data } = input as {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      };
      const matching = sessions.filter((session) => matches(session, where));
      matching.forEach((session) => applyData(session, data));
      return { count: matching.length };
    },
  };

  const client = {
    sessions,
    operations,
    transactionCount: 0,
    mobileDeviceSession: model,
    $transaction: <T>(
      callback: (transaction: { mobileDeviceSession: typeof model }) => Promise<T>,
      options?: { isolationLevel: "Serializable" },
    ) => {
      client.transactionCount += 1;
      const run = () => callback({ mobileDeviceSession: model });
      if (options?.isolationLevel !== "Serializable") return run();
      if (serializationFailures > 0) {
        serializationFailures -= 1;
        return Promise.reject(Object.assign(new Error("write conflict"), { code: "P2034" }));
      }
      const uniqueConflict = uniqueConflicts.shift();
      if (uniqueConflict) {
        return Promise.reject(
          Object.assign(new Error("unique constraint conflict"), {
            code: "P2002",
            meta: uniqueConflict,
          }),
        );
      }

      const pending = serializableTail.then(run);
      serializableTail = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
  };

  return client;
}

function sessionInput() {
  return {
    userId: "user_1",
    membershipId: "membership_1",
    societyId: "society_a",
    installationId: "installation_1",
    platform: "android" as const,
    appVersion: "1.0.0",
    deviceName: "Pixel 9",
    activeRole: "resident" as const,
    activePermissionRole: "member",
  };
}

function createRepository(client = createClient()) {
  return {
    client,
    repository: new MobileDeviceSessionRepository(client, createConfig()),
  };
}

describe("MobileDeviceSessionRepository", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores only a hash when issuing a renewable credential", async () => {
    const { client, repository } = createRepository();

    const issued = await repository.createSession(sessionInput());

    const create = client.operations.find((operation) => operation.action === "create");
    const data = (create?.input as { data: Record<string, unknown> }).data;
    const secret = issued.credential.split(".")[1];
    expect(issued.credential).toMatch(new RegExp(`^${issued.sessionId}\\.[A-Za-z0-9_-]{43}$`));
    expect(data.refreshTokenHash).toEqual(expect.any(String));
    expect(data).not.toHaveProperty("refreshToken");
    expect(JSON.stringify(data)).not.toContain(issued.credential);
    expect(JSON.stringify(data)).not.toContain(secret);
    expect(client.transactionCount).toBe(1);
  });

  it("replaces an active session for the same installation while preserving history", async () => {
    const { client, repository } = createRepository();
    const first = await repository.createSession(sessionInput());

    const second = await repository.createSession(sessionInput());

    expect(client.sessions).toHaveLength(2);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(client.sessions[1].refreshFamilyId).not.toBe(client.sessions[0].refreshFamilyId);
    expect(client.sessions[0]).toMatchObject({
      id: first.sessionId,
      revokedAt: NOW,
      revokeReason: "replaced_by_new_login",
    });
    expect(client.sessions[1]).toMatchObject({
      id: second.sessionId,
      revokedAt: null,
      revokeReason: null,
    });
  });

  it("serializes concurrent replacements so only one session remains active", async () => {
    const { client, repository } = createRepository();

    const [first, second] = await Promise.all([
      repository.createSession(sessionInput()),
      repository.createSession(sessionInput()),
    ]);

    expect(first.sessionId).not.toBe(second.sessionId);
    expect(client.sessions).toHaveLength(2);
    expect(client.sessions.filter((session) => session.revokedAt === null)).toHaveLength(1);
    expect(client.sessions.filter((session) => session.revokeReason === "replaced_by_new_login"))
      .toHaveLength(1);
  });

  it("retries a serializable replacement after a database write conflict", async () => {
    const client = createClient({ serializationFailures: 1 });
    const { repository } = createRepository(client);

    await expect(repository.createSession(sessionInput())).resolves.toMatchObject({
      sessionId: expect.any(String),
      version: 1,
    });

    expect(client.transactionCount).toBe(2);
    expect(client.sessions).toHaveLength(1);
  });

  it.each([
    [
      "constraint name",
      { target: "MobileDeviceSession_one_active_installation_idx" },
    ],
    [
      "field target",
      {
        modelName: "MobileDeviceSession",
        target: ["userId", "societyId", "installationId"],
      },
    ],
  ])("retries an active-installation P2002 reported by %s", async (_label, meta) => {
    const client = createClient({ uniqueConflicts: [meta] });
    const { repository } = createRepository(client);

    await expect(repository.createSession(sessionInput())).resolves.toMatchObject({
      sessionId: expect.any(String),
      version: 1,
    });

    expect(client.transactionCount).toBe(2);
    expect(client.sessions).toHaveLength(1);
  });

  it("does not retry an unrelated P2002", async () => {
    const client = createClient({
      uniqueConflicts: [
        {
          modelName: "MobileDeviceSession",
          target: ["refreshTokenHash"],
        },
      ],
    });
    const { repository } = createRepository(client);

    await expect(repository.createSession(sessionInput())).rejects.toMatchObject({
      code: "P2002",
    });
    expect(client.transactionCount).toBe(1);
    expect(client.sessions).toHaveLength(0);
  });

  it("rotates a valid credential and advances its rotation state", async () => {
    const { client, repository } = createRepository();
    const issued = await repository.createSession(sessionInput());
    const originalHash = client.sessions[0].refreshTokenHash;
    vi.setSystemTime(new Date("2026-07-14T12:05:00.000Z"));

    const rotated = await repository.rotate(issued.credential);

    expect(rotated.sessionId).toBe(issued.sessionId);
    expect(rotated.credential).not.toBe(issued.credential);
    expect(client.sessions[0].refreshTokenHash).not.toBe(originalHash);
    expect(client.sessions[0].refreshRotation).toBe(1);
    expect(client.sessions[0].lastSeenAt).toEqual(new Date("2026-07-14T12:05:00.000Z"));
    expect(client.transactionCount).toBe(2);
  });

  it("revokes the session when a credential replaced by rotation is reused", async () => {
    const { client, repository } = createRepository();
    const issued = await repository.createSession(sessionInput());
    await repository.rotate(issued.credential);

    await expect(repository.rotate(issued.credential)).rejects.toThrow(/refresh_reuse_detected/);

    expect(client.sessions[0]).toMatchObject({
      revokedAt: NOW,
      revokeReason: "refresh_reuse_detected",
    });
  });

  it("allows only one concurrent rotation and revokes the raced credential as reuse", async () => {
    const { client, repository } = createRepository();
    const issued = await repository.createSession(sessionInput());

    const rotations = await Promise.allSettled([
      repository.rotate(issued.credential),
      repository.rotate(issued.credential),
    ]);

    expect(rotations.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(rotations.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(client.sessions[0]).toMatchObject({
      refreshRotation: 1,
      revokedAt: NOW,
      revokeReason: "refresh_reuse_detected",
    });
  });

  it("does not revoke a newer login when an older replaced credential is presented", async () => {
    const { client, repository } = createRepository();
    const first = await repository.createSession(sessionInput());
    const second = await repository.createSession(sessionInput());

    await expect(repository.rotate(first.credential)).rejects.toThrow(/revoked/);

    expect(client.sessions.find((session) => session.id === second.sessionId)).toMatchObject({
      revokedAt: null,
      revokeReason: null,
    });
  });

  it("does not rotate an expired session", async () => {
    const { repository } = createRepository();
    const issued = await repository.createSession(sessionInput());
    vi.setSystemTime(new Date(issued.expiresAt.getTime() + 1));

    await expect(repository.rotate(issued.credential)).rejects.toThrow(/expired/);
  });

  it("does not rotate an already-revoked session", async () => {
    const { repository } = createRepository();
    const issued = await repository.createSession(sessionInput());
    await repository.revoke(issued.sessionId, "admin_revoked");

    await expect(repository.rotate(issued.credential)).rejects.toThrow(/revoked/);
  });

  it("updates the active role and increments the session version atomically", async () => {
    const { client, repository } = createRepository();
    const issued = await repository.createSession(sessionInput());

    const result = await repository.updateRole(issued.sessionId, "guard", "guard");

    expect(result).toEqual({ version: 2 });
    expect(client.sessions[0]).toMatchObject({
      activeRole: "guard",
      activePermissionRole: "guard",
      version: 2,
    });
    expect(client.transactionCount).toBe(2);
  });

  it("does not report a role update after a concurrent revocation wins", async () => {
    const { client, repository } = createRepository();
    const issued = await repository.createSession(sessionInput());

    const [, roleUpdate] = await Promise.allSettled([
      repository.revoke(issued.sessionId, "admin_revoked"),
      repository.updateRole(issued.sessionId, "guard", "guard"),
    ]);

    expect(roleUpdate).toMatchObject({ status: "rejected" });
    expect(client.sessions[0]).toMatchObject({
      activeRole: "resident",
      activePermissionRole: "member",
      version: 1,
      revokeReason: "admin_revoked",
    });
  });

  it("logs out idempotently using the renewable credential", async () => {
    const { client, repository } = createRepository();
    const issued = await repository.createSession(sessionInput());

    await expect(repository.logout(issued.credential)).resolves.toBeUndefined();
    await expect(repository.logout(issued.credential)).resolves.toBeUndefined();

    expect(client.sessions[0]).toMatchObject({
      revokedAt: NOW,
      revokeReason: "logged_out",
    });
    const logoutUpdates = client.operations.filter((operation) => {
      if (operation.action === "create") return false;
      const data = (operation.input as { data: Record<string, unknown> }).data;
      return data.revokeReason === "logged_out";
    });
    expect(logoutUpdates).toHaveLength(1);
  });
});
