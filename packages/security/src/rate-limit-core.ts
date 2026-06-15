export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyPrefix: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  key: string;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return 1;
    }

    existing.count += 1;
    return existing.count;
  }
}

export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly options: RateLimitOptions,
  ) {}

  async check(identifier: string, action = "default"): Promise<RateLimitDecision> {
    const key = `${this.options.keyPrefix}:${identifier}:${action}`;
    const count = await this.store.increment(key, this.options.windowMs);
    const remaining = Math.max(this.options.limit - count, 0);

    return {
      allowed: count <= this.options.limit,
      limit: this.options.limit,
      remaining,
      key,
    };
  }
}
