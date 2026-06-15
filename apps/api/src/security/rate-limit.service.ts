import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import {
  createRateLimitStore,
  type RateLimitDecision,
  type RateLimitOptions,
  type RateLimitStore,
} from "@society/security/rate-limit-server";

export type { RateLimitStore, RateLimitDecision, RateLimitOptions };

@Injectable()
export class RateLimitService {
  private readonly store: RateLimitStore;

  constructor(
    store?: RateLimitStore,
    private readonly options: RateLimitOptions = {
      limit: 60,
      windowMs: 60_000,
      keyPrefix: "api",
    },
  ) {
    this.store = store ?? createRateLimitStore();
  }

  async check(societyId: string, actorId: string, action: string): Promise<RateLimitDecision> {
    const key = `${this.options.keyPrefix}:${societyId}:${actorId}:${action}`;
    const count = await this.store.increment(key, this.options.windowMs);
    const remaining = Math.max(this.options.limit - count, 0);

    return {
      allowed: count <= this.options.limit,
      limit: this.options.limit,
      remaining,
      key,
    };
  }

  async checkOrThrow(societyId: string, actorId: string, action: string): Promise<RateLimitDecision> {
    const decision = await this.check(societyId, actorId, action);

    if (!decision.allowed) {
      throw new HttpException(
        {
          error: "rate_limit_exceeded",
          key: decision.key,
          limit: decision.limit,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return decision;
  }
}
