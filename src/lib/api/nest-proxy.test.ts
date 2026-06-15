import { describe, expect, it } from "vitest";
import {
  buildDeprecationHeaders,
  getNestApiBaseUrl,
  isNestShimEnabled,
} from "./nest-proxy-config.ts";

describe("nest-proxy-config", () => {
  it("builds sunset and successor headers", () => {
    const headers = buildDeprecationHeaders({
      routePath: "/api/maintenance/bills",
      successorPath: "/api/v1/finance-core/invoices/create",
      sunsetDate: "2026-12-31",
    });

    expect(headers).toMatchObject({
      Sunset: "2026-12-31",
      Link: "</api/v1/finance-core/invoices/create>; rel=\"successor-version\"",
      "X-Legacy-Api-Route": "/api/maintenance/bills",
    });
  });

  it("defaults nest api base url", () => {
    expect(getNestApiBaseUrl()).toContain("localhost");
  });

  it("reports shim disabled by default", () => {
    const previous = process.env.NEST_SHIM_ENABLED;
    delete process.env.NEST_SHIM_ENABLED;
    expect(isNestShimEnabled()).toBe(false);
    process.env.NEST_SHIM_ENABLED = previous;
  });
});
