import {
  register as promRegister,
  Counter,
  Histogram,
  Gauge,
  type Registry,
} from 'prom-client';

export const register: Registry = promRegister;

interface HttpRequestLabels {
  endpoint: string;
  method: string;
  status_code: string;
  tenant_id: string;
}

interface HttpDurationLabels {
  endpoint: string;
  method: string;
  tenant_id: string;
}

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['endpoint', 'method', 'status_code', 'tenant_id'],
  registers: [register],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['endpoint', 'method', 'tenant_id'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'In-flight HTTP requests',
  labelNames: ['endpoint', 'method', 'tenant_id'],
  registers: [register],
});

const chatRequestsTotal = new Counter({
  name: 'chat_requests_total',
  help: 'Total chat requests',
  labelNames: ['tenant_id', 'status'],
  registers: [register],
});

const chatRequestDurationSeconds = new Histogram({
  name: 'chat_request_duration_seconds',
  help: 'Chat request duration in seconds',
  labelNames: ['tenant_id', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const chatErrorsTotal = new Counter({
  name: 'chat_errors_total',
  help: 'Total chat errors',
  labelNames: ['tenant_id', 'error_type'],
  registers: [register],
});

const apiDataExposureTotal = new Counter({
  name: 'api_data_exposure_total',
  help: 'Total potential API data exposure events',
  labelNames: ['tenant_id', 'source'],
  registers: [register],
});

const rateLimitRequestsTotal = new Counter({
  name: 'rate_limit_requests_total',
  help: 'Total rate limiter decisions',
  labelNames: ['tenant_id', 'route', 'decision'],
  registers: [register],
});

const auditEventsTotal = new Counter({
  name: 'audit_events_total',
  help: 'Total emitted audit events',
  labelNames: ['tenant_id', 'action', 'result', 'severity'],
  registers: [register],
});

const chatCircuitBreakerState = new Gauge({
  name: 'chat_circuit_breaker_state',
  help: 'Chat circuit breaker state: 0=OPEN, 1=CLOSED, 2=HALF_OPEN',
  labelNames: ['tenant_id'],
  registers: [register],
});

const chatUpstreamErrorsTotal = new Counter({
  name: 'chat_upstream_errors_total',
  help: 'Total upstream errors from Anthropic',
  labelNames: ['tenant_id', 'status_code'],
  registers: [register],
});

const chatRetryAttemptsTotal = new Counter({
  name: 'chat_retry_attempts_total',
  help: 'Total chat retry attempts',
  labelNames: ['tenant_id'],
  registers: [register],
});

const chatDegradedResponsesTotal = new Counter({
  name: 'chat_degraded_responses_total',
  help: 'Total degraded chat responses',
  labelNames: ['tenant_id', 'reason'],
  registers: [register],
});

const rscPrefetchTotal = new Counter({
  name: 'rsc_prefetch_total',
  help: 'Total RSC prefetch requests',
  labelNames: ['route', 'status'],
  registers: [register],
});

const rscPrefetchDurationSeconds = new Histogram({
  name: 'rsc_prefetch_duration_seconds',
  help: 'RSC prefetch duration in seconds',
  labelNames: ['route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const cacheHitRatio = new Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio',
  labelNames: ['operation'],
  registers: [register],
});

const authValidationDurationSeconds = new Histogram({
  name: 'auth_validation_duration_seconds',
  help: 'Auth validation duration in seconds',
  labelNames: ['type'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

export function recordHttpRequest(labels: HttpRequestLabels): void {
  httpRequestsTotal.inc(labels);
}

export function recordHttpRequestDuration(labels: HttpDurationLabels, durationSeconds: number): void {
  httpRequestDurationSeconds.observe(labels, durationSeconds);
}

export function recordChatRequest(tenantId: string, status: string): void {
  chatRequestsTotal.inc({ tenant_id: tenantId, status });
}

export function recordChatRequestDuration(tenantId: string, status: string, durationSeconds: number): void {
  chatRequestDurationSeconds.observe({ tenant_id: tenantId, status }, durationSeconds);
}

export function recordChatError(tenantId: string, errorType: string): void {
  chatErrorsTotal.inc({ tenant_id: tenantId, error_type: errorType });
}

export function recordApiDataExposure(tenantId: string, source: string): void {
  apiDataExposureTotal.inc({ tenant_id: tenantId, source });
}

export function recordRateLimitRequest(tenantId: string, route: string, decision: string): void {
  rateLimitRequestsTotal.inc({ tenant_id: tenantId, route, decision });
}

export function recordAuditEvent(tenantId: string, action: string, result: string, severity: string): void {
  auditEventsTotal.inc({ tenant_id: tenantId, action, result, severity });
}

export function trackHttpRequestInFlight(labels: HttpDurationLabels, delta: number): void {
  httpRequestsInFlight.inc(labels, delta);
}

export function setCircuitBreakerState(tenantId: string, state: number): void {
  chatCircuitBreakerState.set({ tenant_id: tenantId }, state);
}

export function recordChatUpstreamError(tenantId: string, statusCode: string): void {
  chatUpstreamErrorsTotal.inc({ tenant_id: tenantId, status_code: statusCode });
}

export function recordChatRetryAttempt(tenantId: string): void {
  chatRetryAttemptsTotal.inc({ tenant_id: tenantId });
}

export function recordChatDegradedResponse(tenantId: string, reason: string): void {
  chatDegradedResponsesTotal.inc({ tenant_id: tenantId, reason });
}

export function recordRscPrefetch(route: string, status: string, durationSeconds?: number): void {
  rscPrefetchTotal.inc({ route, status });
  if (durationSeconds !== undefined) {
    rscPrefetchDurationSeconds.observe({ route }, durationSeconds);
  }
}

export function setCacheHitRatio(operation: string, ratio: number): void {
  cacheHitRatio.set({ operation }, ratio);
}

export function recordAuthValidationDuration(type: string, durationSeconds: number): void {
  authValidationDurationSeconds.observe({ type }, durationSeconds);
}
