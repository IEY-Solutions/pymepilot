import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { resetCircuitBreakerCache, getCircuitBreaker } from '@/lib/chat/circuit-breaker';

describe('GET /api/health', () => {
  beforeEach(() => {
    resetCircuitBreakerCache();
  });

  it('returns overall status and llm_upstream status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBeDefined();
    expect(data.llm_upstream).toBeDefined();
    expect(data.llm_upstream.status).toMatch(/healthy|degraded|unhealthy/);
    expect(data.timestamp).toBeDefined();
  });

  it('marks llm_upstream unhealthy when circuit is OPEN', async () => {
    const cb = getCircuitBreaker('tenant-1');
    const failingFn = async () => {
      throw new Error('fail');
    };

    for (let i = 0; i < 10; i++) {
      try {
        await cb.fire(failingFn);
      } catch {
        // expected
      }
    }

    const response = await GET();
    const data = await response.json();

    expect(data.llm_upstream.status).toBe('unhealthy');
    expect(data.llm_upstream.circuit_state).toBe('OPEN');
    expect(data.llm_upstream.failures).toBeGreaterThanOrEqual(5);
  });

  it('includes tenant circuit states', async () => {
    const cb = getCircuitBreaker('tenant-open');
    const failingFn = async () => {
      throw new Error('fail');
    };

    for (let i = 0; i < 10; i++) {
      try {
        await cb.fire(failingFn);
      } catch {
        // expected
      }
    }

    const response = await GET();
    const data = await response.json();

    expect(data.circuits).toBeInstanceOf(Array);
    const tenantCircuit = data.circuits.find(
      (c: { tenant_id: string }) => c.tenant_id === 'tenant-open'
    );
    expect(tenantCircuit).toBeDefined();
    expect(tenantCircuit.state).toBe('OPEN');
  });
});
