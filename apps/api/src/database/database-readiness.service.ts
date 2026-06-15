import { Inject, Injectable, Optional } from "@nestjs/common";
import { getDatabaseTarget, prisma } from "../../../../packages/db/src/index.ts";

export interface DatabasePingClient {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
}

export interface DatabaseReadinessOptions {
  databaseUrl?: string;
  now?: () => Date;
}

export interface DatabaseReadinessSnapshot {
  service: "database";
  status: "ok" | "degraded";
  target: string;
  timestamp: string;
  latencyMs: number;
  error?: string;
}

export const DATABASE_PING_CLIENT = Symbol("DATABASE_PING_CLIENT");
export const DATABASE_READINESS_OPTIONS = Symbol("DATABASE_READINESS_OPTIONS");

@Injectable()
export class DatabaseReadinessService {
  private readonly databaseUrl: string | undefined;
  private readonly now: () => Date;

  constructor(
    @Optional()
    @Inject(DATABASE_PING_CLIENT)
    private readonly client: DatabasePingClient = prisma,
    @Optional()
    @Inject(DATABASE_READINESS_OPTIONS)
    options: DatabaseReadinessOptions = {},
  ) {
    this.databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
    this.now = options.now ?? (() => new Date());
  }

  async snapshot(): Promise<DatabaseReadinessSnapshot> {
    const startedAt = Date.now();
    const timestamp = this.now().toISOString();

    try {
      await this.client.$queryRawUnsafe("SELECT 1");

      return {
        service: "database",
        status: "ok",
        target: getDatabaseTarget(this.databaseUrl),
        timestamp,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        service: "database",
        status: "degraded",
        target: getDatabaseTarget(this.databaseUrl),
        timestamp,
        latencyMs: Date.now() - startedAt,
        error: "Database readiness check failed",
      };
    }
  }
}
