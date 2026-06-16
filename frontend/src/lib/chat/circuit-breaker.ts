import CircuitBreaker from 'opossum';
import { LRUCache } from 'lru-cache';
import { getLogger } from '@/lib/observability/logger';
import { setCircuitBreakerState } from '@/lib/observability/metrics';

export type CircuitBreakerState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

const CIRCUIT_BREAKER_CONFIG = {
  // Open when 50% of calls in the window fail; combined with volumeThreshold: 10
  // this means 5 failures out of the last 10 calls will open the circuit.
  errorThresholdPercentage: 50,
  volumeThreshold: 10,
  resetTimeout: 60000, // ms before allowing a single probe request
  rollingCountTimeout: 10000, // window over which failures are counted
  rollingCountBuckets: 1,
  timeout: 60000, // timeout is handled by the resilience wrapper; CB window must not trip first
};

const MAX_TENANTS = 1000;

const CB_STATE_TO_NUMBER: Record<CircuitBreakerState, number> = {
  CLOSED: 1,
  HALF_OPEN: 2,
  OPEN: 0,
};

const circuitBreakers = new LRUCache<string, CircuitBreaker>({
  max: MAX_TENANTS,
});

const circuitBreakerCorrelationIds = new Map<string, string>();

function attachCircuitBreakerListeners(
  tenantId: string,
  breaker: CircuitBreaker
): void {
  const logger = getLogger();

  breaker.on('open', () => {
    const stats = breaker.stats;
    setCircuitBreakerState(tenantId, CB_STATE_TO_NUMBER.OPEN);
    logger.warn({
      message: 'Circuit breaker opened',
      event: 'circuit_breaker.opened',
      tenant_id: tenantId,
      failure_count: stats.failures,
      correlation_id: circuitBreakerCorrelationIds.get(tenantId),
    });
  });

  breaker.on('halfOpen', () => {
    setCircuitBreakerState(tenantId, CB_STATE_TO_NUMBER.HALF_OPEN);
  });

  breaker.on('close', () => {
    setCircuitBreakerState(tenantId, CB_STATE_TO_NUMBER.CLOSED);
    logger.info({
      message: 'Circuit breaker closed',
      event: 'circuit_breaker.closed',
      tenant_id: tenantId,
    });
  });
}

export function setCircuitBreakerCorrelationId(
  tenantId: string,
  correlationId: string
): void {
  circuitBreakerCorrelationIds.set(tenantId, correlationId);
}

export function getCircuitBreaker(tenantId: string): CircuitBreaker {
  const existing = circuitBreakers.get(tenantId);
  if (existing) {
    return existing;
  }

  // Opossum requires an action at construction time, but we want to reuse the
  // same breaker for multiple different actions ( Anthropic calls). We pass a
  // no-op identity function and invoke `fire` with the real action as the first
  // argument; the wrapper will call the action inside.
  const breaker = new CircuitBreaker(async (fn: () => Promise<unknown>) => fn(), {
    ...CIRCUIT_BREAKER_CONFIG,
    name: `chat-cb-${tenantId}`,
  });

  setCircuitBreakerState(tenantId, CB_STATE_TO_NUMBER.CLOSED);
  attachCircuitBreakerListeners(tenantId, breaker);
  circuitBreakers.set(tenantId, breaker);
  return breaker;
}

export function getCircuitBreakerState(tenantId: string): CircuitBreakerState {
  const breaker = circuitBreakers.get(tenantId);
  if (!breaker) {
    return 'CLOSED';
  }

  if (breaker.opened) return 'OPEN';
  if (breaker.halfOpen) return 'HALF_OPEN';
  return 'CLOSED';
}

export function resetCircuitBreakerCache(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.shutdown();
  }
  circuitBreakers.clear();
  circuitBreakerCorrelationIds.clear();
}

export function getAllCircuitBreakerStates(): Array<{
  tenant_id: string;
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  fires: number;
}> {
  const states: ReturnType<typeof getAllCircuitBreakerStates> = [];
  for (const [tenantId, breaker] of circuitBreakers.entries()) {
    const stats = breaker.stats;
    states.push({
      tenant_id: tenantId,
      state: getCircuitBreakerState(tenantId),
      failures: stats.failures,
      successes: stats.successes,
      fires: stats.fires,
    });
  }
  return states;
}
