export function getNestApiBaseUrl(): string {
  return (
    process.env.NEST_API_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  ).replace(/\/$/, "");
}

export function isNestShimEnabled(): boolean {
  return process.env.NEST_SHIM_ENABLED === "true";
}

export interface DeprecationHeaderOptions {
  routePath: string;
  successorPath?: string;
  sunsetDate?: string;
}

export function buildDeprecationHeaders(options: DeprecationHeaderOptions): HeadersInit {
  const sunset = options.sunsetDate ?? "2026-12-31";
  const successor = options.successorPath ?? "";
  const headers: Record<string, string> = {
    Sunset: sunset,
    "X-Legacy-Api-Route": options.routePath,
  };

  if (successor) {
    headers.Link = `<${successor}>; rel="successor-version"`;
  }

  return headers;
}
