import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the default limit', () => {
    const limiter = new RateLimiter();

    for (let i = 0; i < 30; i++) {
      const result = limiter.check('user-1', '/api/pipeline');
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the 31st request within the same window', () => {
    const limiter = new RateLimiter();

    for (let i = 0; i < 30; i++) {
      limiter.check('user-1', '/api/pipeline');
    }

    const result = limiter.check('user-1', '/api/pipeline');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('resets the counter after the window expires', () => {
    const limiter = new RateLimiter();

    for (let i = 0; i < 30; i++) {
      limiter.check('user-1', '/api/pipeline');
    }
    expect(limiter.check('user-1', '/api/pipeline').allowed).toBe(false);

    vi.advanceTimersByTime(60_000);

    const result = limiter.check('user-1', '/api/pipeline');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it('does not let one user consume another users quota', () => {
    const limiter = new RateLimiter();

    for (let i = 0; i < 30; i++) {
      limiter.check('user-a', '/api/pipeline');
    }

    const result = limiter.check('user-b', '/api/pipeline');
    expect(result.allowed).toBe(true);
  });

  it('isolates different routes for the same user', () => {
    const limiter = new RateLimiter();

    for (let i = 0; i < 30; i++) {
      limiter.check('user-1', '/api/pipeline');
    }

    const result = limiter.check('user-1', '/api/key-accounts');
    expect(result.allowed).toBe(true);
  });

  it('respects custom limits and windows', () => {
    const limiter = new RateLimiter();

    for (let i = 0; i < 5; i++) {
      limiter.check('user-1', '/api/chat', { limit: 5, windowMs: 10_000 });
    }

    const blocked = limiter.check('user-1', '/api/chat', { limit: 5, windowMs: 10_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(10);
  });
});
