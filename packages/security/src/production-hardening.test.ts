import { describe, expect, it } from "vitest";
import { resetRateLimitStoreForTests } from "./valkey-rate-limit.ts";
import { RateLimiter, InMemoryRateLimitStore } from "./rate-limit-core.ts";
import { canAccessLegacyRoute } from "./legacy-route-policy.ts";

describe("rate limit store", () => {
  it("tracks limits in memory", async () => {
    resetRateLimitStoreForTests();
    const limiter = new RateLimiter(new InMemoryRateLimitStore(), {
      limit: 2,
      windowMs: 60_000,
      keyPrefix: "test",
    });

    await expect(limiter.check("user_a", "login")).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check("user_a", "login")).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check("user_a", "login")).resolves.toMatchObject({ allowed: false });
  });
});

describe("legacy route policy", () => {
  it("allows residents to view their bills", () => {
    expect(
      canAccessLegacyRoute({
        role: "member",
        societyId: "soc_1",
        subject: "user_1",
        pathname: "/my-bills",
      }),
    ).toBe(true);
  });

  it("denies residents from committee finance management pages", () => {
    expect(
      canAccessLegacyRoute({
        role: "member",
        societyId: "soc_1",
        subject: "user_1",
        pathname: "/expenses",
      }),
    ).toBe(false);
  });

  it("allows guards to access visitor workflows", () => {
    expect(
      canAccessLegacyRoute({
        role: "guard",
        societyId: "soc_1",
        subject: "guard_1",
        pathname: "/visitors",
      }),
    ).toBe(true);
  });
});
