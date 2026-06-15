"use client";

import {
  enqueueOfflineRequest,
  getCachedApi,
  logMobileDiagnostic,
  setCachedApi,
  type QueuePriority,
} from "@/lib/mobile/offline-db";

interface MobileFetchOptions extends RequestInit {
  cacheKey?: string;
  ttlMs?: number;
  queueOnOffline?: boolean;
  queuePriority?: QueuePriority;
  dedupeKey?: string;
}

export class OfflineQueuedError extends Error {
  constructor() {
    super("Request queued and will sync when online");
    this.name = "OfflineQueuedError";
  }
}

function isGet(method?: string) {
  return !method || method.toUpperCase() === "GET";
}

function normalizeHeaders(headers?: HeadersInit) {
  const normalized: Record<string, string> = {};
  if (!headers) return normalized;
  new Headers(headers).forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

export function connectionQuality() {
  if (typeof navigator === "undefined") return "unknown";
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean; downlink?: number };
  }).connection;

  if (!connection) return "unknown";
  if (connection.saveData) return "save-data";
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return "poor";
  if (connection.effectiveType === "3g") return "moderate";
  return "good";
}

export async function mobileFetchJson<T>(url: string, options: MobileFetchOptions = {}): Promise<{
  data: T;
  stale: boolean;
  fromCache: boolean;
}> {
  const method = options.method?.toUpperCase() || "GET";
  const cacheKey = options.cacheKey || `${method}:${url}`;
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const cached = await getCachedApi<T>(cacheKey);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const headers = normalizeHeaders(options.headers);
  const startedAt = performance.now();

  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  if (!online && cached && isGet(method)) {
    return { data: cached.data, stale: true, fromCache: true };
  }

  if (!online && options.queueOnOffline && !isGet(method)) {
    await enqueueOfflineRequest({
      url,
      method,
      headers,
      body: typeof options.body === "string" ? options.body : options.body ? JSON.stringify(options.body) : undefined,
      priority: options.queuePriority || "normal",
      dedupeKey: options.dedupeKey || `${method}:${url}:${JSON.stringify(options.body || "")}`,
    });
    throw new OfflineQueuedError();
  }

  try {
    const response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 304 && cached) {
      return { data: cached.data, stale: false, fromCache: true };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as T;
    const etag = response.headers.get("ETag");

    if (isGet(method)) {
      await setCachedApi({
        key: cacheKey,
        url,
        data,
        etag,
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      });
    }

    await logMobileDiagnostic({
      type: "api",
      message: "api_request_success",
      metadata: {
        url,
        method,
        latencyMs: Math.round(performance.now() - startedAt),
        connection: connectionQuality(),
      },
    });

    return { data, stale: false, fromCache: false };
  } catch (error) {
    if (cached && isGet(method)) {
      await logMobileDiagnostic({
        type: "offline",
        message: "served_stale_cache",
        metadata: { url, method, error: error instanceof Error ? error.message : "unknown" },
      });
      return { data: cached.data, stale: true, fromCache: true };
    }

    if (options.queueOnOffline && !isGet(method)) {
      await enqueueOfflineRequest({
        url,
        method,
        headers,
        body: typeof options.body === "string" ? options.body : options.body ? JSON.stringify(options.body) : undefined,
      priority: options.queuePriority || "normal",
        dedupeKey: options.dedupeKey || `${method}:${url}:${JSON.stringify(options.body || "")}`,
      });
      throw new OfflineQueuedError();
    }

    throw error;
  }
}
