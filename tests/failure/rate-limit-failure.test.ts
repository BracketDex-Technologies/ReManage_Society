import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { RateLimitService, type RateLimitStore } from "../../apps/api/src/security/rate-limit.service.ts";

class MemoryStore implements RateLimitStore {
  private counts = new Map<string, number>();

  async increment(key: string, _windowMs: number): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}

describe("rate limit failure", () => {
  it("throws 429 when limit is exceeded", async () => {
    const service = new RateLimitService(new MemoryStore(), {
      limit: 1,
      windowMs: 60_000,
      keyPrefix: "api",
    });

    await service.checkOrThrow("society_a", "user_1", "login");

    await expect(service.checkOrThrow("society_a", "user_1", "login")).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    try {
      await service.checkOrThrow("society_a", "user_1", "login");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });
});
