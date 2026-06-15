import { Injectable, NestMiddleware } from "@nestjs/common";

interface HeaderResponse {
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
}

const SECURITY_HEADERS: readonly [string, string][] = [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "no-referrer"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
  ["cross-origin-opener-policy", "same-origin"],
  ["cross-origin-resource-policy", "same-origin"],
  [
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  ],
];

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_request: unknown, response: HeaderResponse, next: () => void): void {
    for (const [name, value] of SECURITY_HEADERS) {
      if (typeof response.header === "function") {
        response.header(name, value);
      } else if (typeof response.setHeader === "function") {
        response.setHeader(name, value);
      }
    }

    next();
  }
}

