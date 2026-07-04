import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCircuitBreaker, getCircuitBreakerState, resetCircuitBreakerCache, setCircuitBreakerCorrelationId } from './circuit-breaker';
import CircuitBreaker from 'opossum';

const { warnMock, infoMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
  infoMock: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  getLogger: vi.fn(() => ({
    warn: warnMock,
    info: infoMock,
  })),
}));

describe('chat circuit breaker', () => {
  beforeEach(() => {
    resetCircuitBreakerCache();
    vi.clearAllMocks();
  });

  it('returns a circuit breaker for a tenant', () => {
    const cb = getCircuitBreaker('tenant-1');
    expect(cb).toBeDefined();
    expect(typeof cb.fire).toBe('function');
  });

  it('returns the same instance for the same tenant', () => {
    const cb1 = getCircuitBreaker('tenant-1');
    const cb2 = getCircuitBreaker('tenant-1');
    expect(cb1).toBe(cb2);
  });

  it('returns different instances for different tenants', () => {
    const cb1 = getCircuitBreaker('tenant-a');
    const cb2 = getCircuitBreaker('tenant-b');
    expect(cb1).not.toBe(cb2);
  });

  it('opens after 5 failures out of 10 calls', async () => {
    const cb = getCircuitBreaker('tenant-1') as CircuitBreaker;
    const failingFn = async () => {
      throw new Error('upstream failure');
    };

    // Fire 10 failing calls; opossum needs volumeThreshold calls before it
    // can open based on percentage.
    for (let i = 0; i < 10; i++) {
      try {
        await cb.fire(failingFn);
      } catch {
        // expected
      }
    }

    expect(cb.opened).toBe(true);
    expect(getCircuitBreakerState('tenant-1')).toBe('OPEN');
  });

  it('stays closed when fewer than 5 of 10 calls fail', async () => {
    const cb = getCircuitBreaker('tenant-1') as CircuitBreaker;
    const mixedFn = async () => {
      // 3 failures, 7 successes
      if (Math.random() < 0.3) throw new Error('upstream failure');
      return 'ok';
    };

    // Deterministic: seed with 3 failures then 7 successes
    let calls = 0;
    const deterministic = async () => {
      calls++;
      if (calls <= 3) throw new Error('upstream failure');
      return 'ok';
    };

    for (let i = 0; i < 10; i++) {
      try {
        await cb.fire(deterministic);
      } catch {
        // expected for failures
      }
    }

    expect(cb.opened).toBe(false);
    expect(getCircuitBreakerState('tenant-1')).toBe('CLOSED');
  });

  it('exposes helper to read current circuit state', async () => {
    const cb = getCircuitBreaker('tenant-1') as CircuitBreaker;
    expect(getCircuitBreakerState('tenant-1')).toBe('CLOSED');

    const failingFn = async () => {
      throw new Error('upstream failure');
    };

    for (let i = 0; i < 10; i++) {
      try {
        await cb.fire(failingFn);
      } catch {
        // expected
      }
    }

    expect(getCircuitBreakerState('tenant-1')).toBe('OPEN');
  });

  it('has a 60 second reset timeout', () => {
    const cb = getCircuitBreaker('tenant-1') as CircuitBreaker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((cb as any).options.resetTimeout).toBe(60000);
  });

  it('bounds correlation ids to the configured tenant cache size', () => {
    const cb = getCircuitBreaker('tenant-1') as CircuitBreaker;

    for (let i = 0; i < 1001; i++) {
      const tenantId = i === 0 ? 'tenant-1' : `tenant-${i + 1}`;
      const correlationId = `corr-${i + 1}`;
      setCircuitBreakerCorrelationId(tenantId, correlationId);
    }

    cb.emit('open');

    expect(warnMock).toHaveBeenCalled();
    expect(warnMock.mock.calls[0][0]).toMatchObject({
      tenant_id: 'tenant-1',
      event: 'circuit_breaker.opened',
    });
    expect(warnMock.mock.calls[0][0].correlation_id).toBeUndefined();
  });

  it('shuts down evicted breakers when the tenant cache exceeds the max size', () => {
    const shutdownSpy = vi.spyOn(CircuitBreaker.prototype, 'shutdown').mockImplementation(function () {
      return undefined as never;
    });

    try {
      getCircuitBreaker('tenant-1');

      for (let i = 2; i <= 1001; i++) {
        getCircuitBreaker(`tenant-${i}`);
      }

      expect(shutdownSpy).toHaveBeenCalledTimes(1);
    } finally {
      shutdownSpy.mockRestore();
    }
  });
});
