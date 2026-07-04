import { NextResponse } from 'next/server';
import { getAllCircuitBreakerStates } from '@/lib/chat/circuit-breaker';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  llm_upstream: {
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
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

  const now = new Date().toISOString();

  return NextResponse.json({
    status: overallStatus,
    llm_upstream: {
      status: upstreamStatus,
    },
    timestamp: now,
  });
}
