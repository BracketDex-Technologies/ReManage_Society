import "server-only";
import { mintBffBridgeToken } from "@society/security";
import type { SessionPayload } from "@/lib/session";
import { getNestApiBaseUrl } from "./nest-proxy-config.ts";

export {
  buildDeprecationHeaders,
  getNestApiBaseUrl,
  isNestShimEnabled,
} from "./nest-proxy-config.ts";
export type { DeprecationHeaderOptions } from "./nest-proxy-config.ts";

const RATE_LIMIT_HEADERS = ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining"] as const;

export interface NestProxyOptions {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  session: SessionPayload;
  idempotencyKey?: string;
}

export async function mintSessionBridgeToken(session: SessionPayload): Promise<string> {
  return mintBffBridgeToken({
    subject: session.userId,
    societyId: session.societyId,
    role: session.role,
  });
}

export async function proxyNestJson<T = unknown>(options: NestProxyOptions): Promise<{
  ok: boolean;
  status: number;
  data: T;
  headers: Headers;
}> {
  const bridgeEnabled = process.env.API_BFF_BRIDGE_ENABLED !== "false";
  const token = (!bridgeEnabled && options.session.accessToken)
    ? options.session.accessToken
    : await mintSessionBridgeToken(options.session);
  const method = options.method ?? "POST";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-society-id": options.session.societyId,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const response = await fetch(`${getNestApiBaseUrl()}${options.path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
    cache: "no-store",
  });

  const text = await response.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = { error: text || "Invalid JSON from Nest API" } as T;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    headers: response.headers,
  };
}

export function passThroughRateLimitHeaders(source: Headers): HeadersInit {
  const headers: Record<string, string> = {};
  for (const name of RATE_LIMIT_HEADERS) {
    const value = source.get(name);
    if (value) {
      headers[name] = value;
    }
  }
  return headers;
}

export function jsonWithHeaders(
  body: unknown,
  init: ResponseInit & { extraHeaders?: HeadersInit },
): Response {
  const headers = new Headers(init.headers);
  if (init.extraHeaders) {
    const extra = new Headers(init.extraHeaders);
    extra.forEach((value, key) => headers.set(key, value));
  }
  headers.set("Content-Type", "application/json");
  return Response.json(body, { ...init, headers });
}
