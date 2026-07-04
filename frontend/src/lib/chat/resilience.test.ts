import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withResilience, type ResilientError } from './resilience';
import { resetCircuitBreakerCache } from './circuit-breaker';

describe('chat resilience wrapper', () => {
  beforeEach(() => {
    resetCircuitBreakerCache();
    vi.useRealTimers();
  });

  it('returns the result on success', async () => {
    const result = await withResilience('tenant-1', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('retries transient errors up to 3 times then throws', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      const err = new Error('transient') as ResilientError;
      err.status = 503;
      throw err;
    };

    await expect(
      withResilience('tenant-1', operation, { baseDelayMs: 10 })
    ).rejects.toThrow();
    expect(attempts).toBe(4); // initial + 3 retries
  });

  it('does not retry 429 rate limit errors', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      const err = new Error('too many requests') as ResilientError;
      err.status = 429;
      err.retryAfter = 65;
      throw err;
    };

    await expect(withResilience('tenant-1', operation)).rejects.toThrow('Límite de consultas alcanzado');
    expect(attempts).toBe(1);
  });

  it('uses default 30s timeout', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const operation = async () => 'ok';

    await withResilience('tenant-1', operation);

    const timeoutCall = setTimeoutSpy.mock.calls.find(
      (call) => typeof call[1] === 'number' && call[1] === 30000
    );
    expect(timeoutCall).toBeDefined();
    setTimeoutSpy.mockRestore();
  });

  it('uses custom timeout when provided', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const operation = async () => 'ok';

    await withResilience('tenant-1', operation, { timeoutMs: 500 });

    const timeoutCall = setTimeoutSpy.mock.calls.find(
      (call) => typeof call[1] === 'number' && call[1] === 500
    );
    expect(timeoutCall).toBeDefined();
    setTimeoutSpy.mockRestore();
  });

  it('converts AbortError into user-facing timeout error after retries', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      const abortErr = new Error('timeout') as ResilientError;
      abortErr.name = 'AbortError';
      throw abortErr;
    };

    await expect(
      withResilience('tenant-1', operation, { timeoutMs: 50, baseDelayMs: 10 })
    ).rejects.toThrow('no está disponible en este momento');
    expect(attempts).toBe(4); // initial + 3 retries
  });

  it('opens circuit breaker after repeated failures', async () => {
    const operation = async () => {
      const err = new Error('transient') as ResilientError;
      err.status = 503;
      throw err;
    };

    // Exhaust retries for one call (4 attempts), repeat enough to open circuit.
    for (let i = 0; i < 10; i++) {
      try {
        await withResilience('tenant-1', operation, { baseDelayMs: 10 });
      } catch {
        // expected
      }
    }

    // Next call should fail fast with circuit open.
    await expect(withResilience('tenant-1', async () => 'ok')).rejects.toThrow(
      'no está disponible en este momento'
    );
  });

  it('passes an abort signal to the operation', async () => {
    let receivedSignal: AbortSignal | undefined;
    const operation = async (signal: AbortSignal) => {
      receivedSignal = signal;
      return 'ok';
    };

    await withResilience('tenant-1', operation);
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(false);
  });
});
