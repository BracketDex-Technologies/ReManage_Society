import "server-only";
import { getSession } from "@/lib/auth";
import type { SessionPayload } from "@/lib/session";
import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";

export interface ShimRouteOptions {
  /** The legacy route path, e.g. "/api/complaints" */
  legacyRoute: string;
  /** The NestJS endpoint to proxy to, e.g. "/api/v1/community/helpdesk/list" */
  nestPath: string;
  /** HTTP method for the proxy call (defaults to POST) */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Build the body to send to the NestJS endpoint */
  buildBody?: (session: SessionPayload, request?: Request) => Promise<unknown> | unknown;
  /** Extract the response key name for the JSON response (e.g. "complaints") */
  responseKey?: string;
  /** Roles allowed; if omitted, any authenticated user with a societyId */
  allowedRoles?: string[];
  /** The HTTP status to return on success (defaults to 200) */
  successStatus?: number;
}

/**
 * Creates a shimmed route handler that proxies to NestJS when shims are enabled,
 * otherwise falls through to the provided legacy handler.
 *
 * Usage:
 * ```ts
 * export const GET = shimOrFallback(
 *   { legacyRoute: "/api/complaints", nestPath: "/api/v1/community/helpdesk/list", responseKey: "complaints" },
 *   legacyGET,
 * );
 * ```
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function shimOrFallback<T extends (...args: any[]) => any>(
  options: ShimRouteOptions,
  legacyHandler: T,
): T {
  return (async (...args: any[]) => {
    const request = args[0] as Request;
    const session = await getSession();
    if (!session?.societyId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (options.allowedRoles && !options.allowedRoles.includes(session.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Try NestJS proxy first
    if (isNestShimEnabled()) {
      try {
        const body = options.buildBody
          ? await options.buildBody(session, request)
          : { societyId: session.societyId };

        const proxied = await proxyNestJson<unknown>({
          path: options.nestPath,
          method: options.method ?? "POST",
          session,
          body,
        });

        if (proxied.ok) {
          const responseData = options.responseKey
            ? { [options.responseKey]: proxied.data }
            : proxied.data;

          return jsonWithHeaders(responseData, {
            status: options.successStatus ?? 200,
            extraHeaders: {
              ...buildDeprecationHeaders({
                routePath: options.legacyRoute,
                successorPath: options.nestPath,
              }),
              ...passThroughRateLimitHeaders(proxied.headers),
            },
          });
        }
        // If proxy fails, fall through to legacy handler
      } catch {
        // Proxy error — fall through to legacy handler
      }
    }

    // Legacy fallback — run the original handler
    return legacyHandler(...args);
  }) as unknown as T;
}

/**
 * Wraps a legacy response with deprecation headers pointing to the NestJS successor.
 */
export function withDeprecationHeaders(
  response: Response,
  legacyRoute: string,
  nestPath: string,
): Response {
  const headers = buildDeprecationHeaders({
    routePath: legacyRoute,
    successorPath: nestPath,
  });
  const newHeaders = new Headers(response.headers);
  const deprecation = new Headers(headers);
  deprecation.forEach((value, key) => newHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
