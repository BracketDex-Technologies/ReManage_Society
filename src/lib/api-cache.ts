/**
 * Lightweight in-memory cache for API responses.
 * Reduces redundant DB queries for identical requests within a short window.
 * Each entry auto-expires after `ttlMs` milliseconds.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// Periodic cleanup every 60s to avoid memory leaks
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
    if (cache.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60_000);
}

/**
 * Get or set a cached value. If the key exists and hasn't expired,
 * returns the cached value. Otherwise, calls `fetcher`, caches the
 * result, and returns it.
 * 
 * @param key   Unique cache key (e.g. `dashboard:${societyId}:${period}`)
 * @param fetcher  Async function that produces the data
 * @param ttlMs    Time-to-live in milliseconds (default: 15s)
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 15_000
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.data;
  }

  const data = await fetcher();
  cache.set(key, { data, expiresAt: now + ttlMs });
  ensureCleanup();
  return data;
}

/**
 * Invalidate cache entries matching a prefix.
 * Call this after mutations (e.g. payment, expense creation).
 */
export function invalidateCache(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * Invalidate all cache entries for a society.
 */
export function invalidateSocietyCache(societyId: string) {
  invalidateCache(`dashboard:${societyId}`);
  invalidateCache(`analytics:${societyId}`);
  invalidateCache(`bills:${societyId}`);
  invalidateCache(`expenses:${societyId}`);
  invalidateCache(`members:${societyId}`);
}
