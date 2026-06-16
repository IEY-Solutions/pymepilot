import { NextResponse } from 'next/server';
import {
  getAllCircuitBreakerStates,
  getCircuitBreakerState,
  type CircuitBreakerState,
} from '@/lib/chat/circuit-breaker';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  llm_upstream: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    circuit_state: CircuitBreakerState;
    failures: number;
    successes: number;
    fires: number;
    last_check: string;
  };
  circuits: Array<{
    tenant_id: string;
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    fires: number;
  }>;
  timestamp: string;
}

export async function GET(): Promise<NextResponse<HealthCheckResult>> {
  const circuits = getAllCircuitBreakerStates();

  // Aggregate circuit state across all known tenants. If any tenant has an
  // OPEN circuit, the upstream is considered unhealthy. If circuits exist but
  // all are closed, healthy.
  const anyOpen = circuits.some((c) => c.state === 'OPEN');
  const anyHalfOpen = circuits.some((c) => c.state === 'HALF_OPEN');

  const upstreamStatus = anyOpen ? 'unhealthy' : anyHalfOpen ? 'degraded' : 'healthy';
  const overallStatus = upstreamStatus === 'unhealthy' ? 'unhealthy' : upstreamStatus;

  const aggregated = circuits.reduce(
    (acc, c) => {
      acc.failures += c.failures;
      acc.successes += c.successes;
      acc.fires += c.fires;
      return acc;
    },
    { failures: 0, successes: 0, fires: 0 }
  );

  // The aggregate circuit_state reflects the worst known state.
  const aggregateState: CircuitBreakerState = anyOpen
    ? 'OPEN'
    : anyHalfOpen
      ? 'HALF_OPEN'
      : 'CLOSED';

  const now = new Date().toISOString();

  return NextResponse.json({
    status: overallStatus,
    llm_upstream: {
      status: upstreamStatus,
      circuit_state: aggregateState,
      failures: aggregated.failures,
      successes: aggregated.successes,
      fires: aggregated.fires,
      last_check: now,
    },
    circuits,
    timestamp: now,
  });
}
