import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { redactDatabaseUrl } from "./connection-url.ts";

interface PrismaGlobals {
  societyPrisma?: PrismaClient;
  societyPool?: Pool;
}

export interface DatabaseRuntimeConfig {
  connectionString?: string;
  poolMax?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  nodeEnv?: string;
}

const globalForPrisma = globalThis as typeof globalThis & PrismaGlobals;

export function requireDatabaseUrl(
  connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL,
): string {
  const value = connectionString?.trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL is missing. Add the pooled Neon connection string to the project .env file and restart the server.",
    );
  }

  const parsed = new URL(value);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the postgresql:// or postgres:// protocol.");
  }

  return value;
}

export function getDatabaseTarget(
  connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL,
): string {
  return redactDatabaseUrl(connectionString);
}

export function createPrismaPool(config: DatabaseRuntimeConfig = {}): Pool {
  return new Pool({
    connectionString: requireDatabaseUrl(
      config.connectionString ?? process.env.DATABASE_URL ?? process.env.DIRECT_URL,
    ),
    max: config.poolMax ?? 5,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5_000,
    allowExitOnIdle: true,
  });
}

export function createPrismaClient(config: DatabaseRuntimeConfig = {}): PrismaClient {
  const adapter = new PrismaPg(createPrismaPool(config));

  return new PrismaClient({
    adapter,
    log: (config.nodeEnv ?? process.env.NODE_ENV) === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrismaPool(): Pool {
  if (!globalForPrisma.societyPool) {
    globalForPrisma.societyPool = createPrismaPool();
  }

  return globalForPrisma.societyPool;
}

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.societyPrisma) {
    const adapter = new PrismaPg(getPrismaPool());

    globalForPrisma.societyPrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalForPrisma.societyPrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrismaClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
