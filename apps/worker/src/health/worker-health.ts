import { Injectable } from "@nestjs/common";
import { URL } from "node:url";

export interface WorkerQueueConnectionConfig {
  host: string;
  port: number;
  url: string;
}

export interface WorkerRuntimeConfig {
  concurrency: number;
  port: number;
  queueConnection: WorkerQueueConnectionConfig;
}

export interface WorkerQueueState {
  queueConnected: boolean;
}

export interface WorkerHealthSnapshot {
  service: "worker";
  status: "ok" | "degraded";
  timestamp: string;
  concurrency: number;
  queue: {
    name: "default";
    status: "connected" | "placeholder";
    connection: WorkerQueueConnectionConfig;
  };
}

const DEFAULT_QUEUE_URL = "redis://localhost:6379";
const DEFAULT_WORKER_PORT = 4010;
const DEFAULT_CONCURRENCY = 5;

function parseInteger(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseQueueConnection(env: Record<string, string | undefined>): WorkerQueueConnectionConfig {
  const url = env.VALKEY_URL || DEFAULT_QUEUE_URL;
  const parsedUrl = new URL(url);
  const port = parseInteger(env.VALKEY_PORT, parseInteger(parsedUrl.port, 6379));

  return {
    host: parsedUrl.hostname || "localhost",
    port,
    url,
  };
}

export function parseWorkerRuntimeConfig(
  env: Record<string, string | undefined>,
): WorkerRuntimeConfig {
  return {
    concurrency: parseInteger(env.WORKER_CONCURRENCY, DEFAULT_CONCURRENCY),
    port: parseInteger(env.WORKER_PORT, DEFAULT_WORKER_PORT),
    queueConnection: parseQueueConnection(env),
  };
}

export function buildWorkerHealthSnapshot(
  config: WorkerRuntimeConfig,
  state: WorkerQueueState,
  now: () => string = () => new Date().toISOString(),
): WorkerHealthSnapshot {
  return {
    service: "worker",
    status: state.queueConnected ? "ok" : "degraded",
    timestamp: now(),
    concurrency: config.concurrency,
    queue: {
      name: "default",
      status: state.queueConnected ? "connected" : "placeholder",
      connection: config.queueConnection,
    },
  };
}

@Injectable()
export class WorkerHealthService {
  private readonly config = parseWorkerRuntimeConfig(process.env);
  private readonly state: WorkerQueueState = {
    queueConnected: false,
  };

  getRuntimeConfig(): WorkerRuntimeConfig {
    return this.config;
  }

  markQueueConnected(queueConnected: boolean): void {
    this.state.queueConnected = queueConnected;
  }

  snapshot(): WorkerHealthSnapshot {
    return buildWorkerHealthSnapshot(this.config, this.state);
  }
}
