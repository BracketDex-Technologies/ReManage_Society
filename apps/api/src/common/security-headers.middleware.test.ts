import { describe, expect, it } from "vitest";
import { SecurityHeadersMiddleware } from "./security-headers.middleware.ts";

describe("SecurityHeadersMiddleware", () => {
  it("sets strict API security headers without unsafe CSP directives", () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader: (name: string, value: string) => headers.set(name, value),
    };

    new SecurityHeadersMiddleware().use({}, response, () => undefined);

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    expect(headers.get("content-security-policy")).not.toContain("unsafe-inline");
    expect(headers.get("content-security-policy")).not.toContain("unsafe-eval");
  });
});
