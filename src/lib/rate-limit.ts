import { createRateLimitStore, RateLimiter } from "@society/security/rate-limit-server";

const store = createRateLimitStore();

const authLimiter = new RateLimiter(store, {
  limit: 15,
  windowMs: 60_000,
  keyPrefix: "auth",
});

const apiLimiter = new RateLimiter(store, {
  limit: 60,
  windowMs: 60_000,
  keyPrefix: "api",
});

export async function authRateLimit(ip: string): Promise<boolean> {
  const decision = await authLimiter.check(ip, "login");
  return decision.allowed;
}

export async function apiRateLimit(userId: string): Promise<boolean> {
  const decision = await apiLimiter.check(userId, "request");
  return decision.allowed;
}
