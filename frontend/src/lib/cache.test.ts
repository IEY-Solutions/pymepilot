import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react', () => ({
  cache: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn(),
}));

import { cache as reactCache } from 'react';
import { unstable_cache } from 'next/cache';
import { withRequestDedup, withSwrCache, withCachedData } from './cache';

describe('cache wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reactCache).mockImplementation((fn) => fn as typeof fn);
    vi.mocked(unstable_cache).mockImplementation((fn) => fn as typeof fn);
  });

  it('wraps a function with React.cache for request deduplication', async () => {
    const fn = vi.fn(async (x: string) => `result-${x}`);

    const wrapped = withRequestDedup(fn);
    const result = await wrapped('a');

    expect(reactCache).toHaveBeenCalledWith(fn);
    expect(fn).toHaveBeenCalledWith('a');
    expect(result).toBe('result-a');
  });

  it('wraps a function with unstable_cache using a tenant-scoped key and 60s SWR', async () => {
    const fn = vi.fn(async (tenantId: string) => ({ count: 42 }));

    const wrapped = withSwrCache('notifications', fn, {
      revalidate: 60,
      tags: ['notifications'],
    });
    const result = await wrapped('tenant-1');

    expect(unstable_cache).toHaveBeenCalledWith(
      fn,
      ['notifications'],
      { revalidate: 60, tags: ['notifications'] }
    );
    expect(fn).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual({ count: 42 });
  });

  it('uses 60s revalidation by default for SWR cache', async () => {
    const fn = vi.fn(async () => 'data');

    withSwrCache('pipeline', fn);

    expect(unstable_cache).toHaveBeenCalledWith(fn, ['pipeline'], {
      revalidate: 60,
      tags: [],
    });
  });

  it('composes request deduplication and SWR caching', async () => {
    const fn = vi.fn(async (tenantId: string) => ({ data: tenantId }));

    const wrapped = withCachedData('pipeline', fn);
    const result = await wrapped('tenant-1');

    expect(unstable_cache).toHaveBeenCalledWith(
      fn,
      ['pipeline'],
      { revalidate: 60, tags: [] }
    );
    expect(reactCache).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual({ data: 'tenant-1' });
  });
});
