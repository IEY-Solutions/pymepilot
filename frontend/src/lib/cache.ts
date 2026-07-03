import { cache as reactCache } from "react";
import { unstable_cache } from "next/cache";

export interface CacheOptions {
  /** Cache TTL in seconds. Default: 60. */
  revalidate?: number;
  /** Next.js cache tags for on-demand revalidation. */
  tags?: string[];
}

/**
 * Dedupes identical in-request fetches. The first call executes the
 * function; subsequent calls with the same arguments return the same
 * promise within the same React render pass.
 */
export function withRequestDedup<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>
): (...args: Args) => Promise<T> {
  return reactCache(fn);
}

/**
 * Adds cross-request SWR caching for request-independent data only.
 * Do not wrap functions that call cookies(), headers(), or createClient()
 * from next/headers/Supabase server helpers. Default revalidation: 60s.
 */
export function withSwrCache<T, Args extends unknown[]>(
  keyPrefix: string,
  fn: (...args: Args) => Promise<T>,
  options: CacheOptions = {}
): (...args: Args) => Promise<T> {
  const { revalidate = 60, tags = [] } = options;
  return unstable_cache(fn, [keyPrefix], { revalidate, tags });
}

/**
 * Combines React.cache (in-request dedup) with unstable_cache
 * (cross-request SWR) for request-independent hot data.
 */
export function withCachedData<T, Args extends unknown[]>(
  keyPrefix: string,
  fn: (...args: Args) => Promise<T>,
  options: CacheOptions = {}
): (...args: Args) => Promise<T> {
  return withRequestDedup(withSwrCache(keyPrefix, fn, options));
}
