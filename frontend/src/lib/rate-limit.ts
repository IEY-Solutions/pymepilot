import { LRUCache } from 'lru-cache';

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. Default: 30. */
  limit?: number;
  /** Window size in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  windowMs: number;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export const DEFAULT_RATE_LIMIT = 30;
export const DEFAULT_WINDOW_MS = 60_000;

/**
 * In-memory per-user rate limiter backed by lru-cache.
 *
 * Each user+route combination gets its own fixed-window counter. When the
 * window expires the counter resets automatically.
 */
export class RateLimiter {
  private cache: LRUCache<string, Bucket>;

  constructor(maxEntries = 10_000) {
    this.cache = new LRUCache<string, Bucket>({ max: maxEntries });
  }

  check(userId: string, route: string, options: RateLimitOptions = {}): RateLimitResult {
    const limit = options.limit ?? DEFAULT_RATE_LIMIT;
    const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    const key = `${userId}:${route}`;
    const now = Date.now();

    const bucket = this.cache.get(key);
    if (!bucket || now >= bucket.resetAt) {
      const resetAt = now + windowMs;
      this.cache.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit,
        windowMs,
        remaining: limit - 1,
        retryAfterSeconds: 0,
      };
    }

    bucket.count++;
    if (bucket.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return {
        allowed: false,
        limit,
        windowMs,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      limit,
      windowMs,
      remaining: limit - bucket.count,
      retryAfterSeconds: 0,
    };
  }

  reset(): void {
    this.cache.clear();
  }
}

export const apiRateLimiter = new RateLimiter();
