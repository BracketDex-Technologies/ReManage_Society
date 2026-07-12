import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

describe("proxy public paths", () => {
  it("allows portal admin page and portal APIs to use their own auth", () => {
    expect(isPublicPath("/registered-society")).toBe(true);
    expect(isPublicPath("/api/portal/auth/status")).toBe(true);
    expect(isPublicPath("/api/portal/registered-societies")).toBe(true);
  });

  it("keeps normal protected APIs behind society auth", () => {
    expect(isPublicPath("/api/credentials")).toBe(false);
  });
});
