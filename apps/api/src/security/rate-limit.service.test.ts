import { describe, expect, it } from "vitest";
import { RateLimitService, type RateLimitStore } from "./rate-limit.service.ts";

class MemoryStore implements RateLimitStore {
  private readonly counts = new Map<string, number>();

  async increment(key: string, windowMs: number): Promise<number> {
    void windowMs;
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}

describe("RateLimitService", () => {
  it("allows requests until the limit is exceeded", async () => {
    const service = new RateLimitService(new MemoryStore(), {
      limit: 2,
      windowMs: 60_000,
      keyPrefix: "api",
    });

    await expect(service.check("society_a", "user_123", "login")).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(service.check("society_a", "user_123", "login")).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(service.check("society_a", "user_123", "login")).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });
});
