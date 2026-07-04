# Observability Foundation Specification

## Purpose

Telemetry, logging, metrics, and alerting foundation for PymePilot production incidents. Covers correlation IDs, structured logging, Prometheus metrics, alerting rules, security audit events, and SLOs. Signals MUST be emitted by chat-resilience, api-data-minimization, and rsc-prefetch-optimization domains.

## Requirements

| # | Requirement | Summary |
|---|------------|---------|
| **R1** | Correlation ID Propagation | UUID v4 `x-correlation-id` per request, propagated through middleware, Next.js, Python backend, Anthropic, DB, Redis. Included in every log line. Returned in `X-Correlation-ID` header. |
| **R2** | Structured JSON Logging | JSON lines with: `timestamp`, `level`, `logger`, `correlation_id`, `tenant_id`, `message`, `context` (flat), `event` (machine-readable). No PII. Console/file same format. |
| **R3** | Prometheus Metrics | `GET /metrics` in Prometheus format. RED: `http_requests_total{endpoint,method,status_code,tenant_id}`, `http_request_duration_seconds{endpoint,method,tenant_id,quantile}`, `http_requests_in_flight{endpoint,method,tenant_id}`. Business: `chat_circuit_breaker_state{tenant_id}`, `chat_upstream_errors_total{tenant_id,status_code}`, `chat_retry_attempts_total{tenant_id}`, `chat_degraded_responses_total{tenant_id,reason}`, `rsc_prefetch_total{route,status}`, `rsc_prefetch_duration_seconds{route,quantile}`, `cache_hit_ratio{operation}`, `auth_validation_duration_seconds{type}`. |
| **R4** | Alerting Rules | P0: ChatUpstreamDown (circuit OPEN>5min), High5xxRate (>5%/2min), AuthValidationDegraded (p95>500ms/5min). P1: RateLimitStorm (>100/tenant/min), PrefetchFailureSpike (>20%/10min), CacheMissSurge (<0.3/5min). P2: RetryRateElevated (3σ), PrefetchLatency (p95>2s/30min), TenantProbingDetected (>5/10min). Auto-resolve required. |
| **R5** | Security Audit Logging | Audit events for `tenant_isolation.probe_attempted`, `auth.access_denied`, `rate_limit.exceeded`, `api_data_access`. Fields: `timestamp`, `actor.{user_id,tenant_id}`, `action`, `resource`, `result`, `correlation_id`, `severity`. MUST NOT be mutable/deletable by app code. Hash IPs; no emails. |

### R1: Correlation ID Propagation

#### Scenario: Correlation links UI error to server logs

- GIVEN a user receives an error in the chat UI
- WHEN the operator searches logs by `X-Correlation-ID` from the browser network tab
- THEN all log lines for that request SHALL be retrieved in chronological order across services

#### Scenario: Correlation crosses service boundaries

- GIVEN a chat request routed: Next.js → Python → Anthropic
- WHEN the correlation ID is logged at each layer
- THEN all entries SHALL share the same `correlation_id`

### R2: Structured JSON Logging

#### Scenario: Operator queries circuit openings by tenant

- GIVEN circuit events logged with `event: "circuit_breaker.opened"` and `tenant_id`
- WHEN an operator queries `event = "circuit_breaker.opened" AND tenant_id = "tenant-a"`
- THEN all events for Tenant A SHALL be returned with timestamps and correlation IDs

#### Scenario: Rate-limit events queryable

- GIVEN rate-limit events logged with `event`, `tenant_id`, and `endpoint`
- WHEN filtered by tenant and endpoint
- THEN all exceedances SHALL be returned sorted by timestamp

### R3: Prometheus Metrics

#### Scenario: Chat error budget burn rate visible

- GIVEN metrics at `/metrics`
- WHEN Prometheus queries `rate(http_requests_total{endpoint="/api/chat",status_code=~"5.."}[5m])`
- THEN the error budget burn rate SHALL be visible before SLO breach

#### Scenario: Circuit breaker gauge reflects state

- GIVEN Tenant A's circuit transitions to OPEN
- WHEN Prometheus scrapes `/metrics`
- THEN `chat_circuit_breaker_state{tenant_id="tenant-a"}` SHALL read `0` (OPEN) and recover to `1` when closed

### R4: Alerting Rules

#### Scenario: Circuit open triggers PagerDuty

- GIVEN a tenant's circuit is OPEN
- WHEN 5 minutes elapse without recovery
- THEN P0 ChatUpstreamDown SHALL fire and SHALL auto-resolve when circuit closes

#### Scenario: Probing alert auto-resolves

- GIVEN TenantProbingDetected fires at 6 probe attempts in 10 min
- WHEN the rate drops below threshold for the evaluation window
- THEN the alert SHALL auto-resolve

### R5: Security Audit Logging

#### Scenario: Cross-tenant probing escalates severity

- GIVEN three `tenant_isolation.probe_attempted` events from the same actor in 10 min
- WHEN the 4th attempt occurs
- THEN severity SHALL escalate from `WARNING` to `CRITICAL` and TenantProbingDetected SHALL fire

#### Scenario: Unauthenticated access logged

- GIVEN a request to `GET /api/pipeline` without a valid session
- WHEN the server returns 401
- THEN an audit event with `action: "auth.access_denied"`, `resource: "/api/pipeline"`, and hashed IP SHALL be emitted

## SLO Definitions

| SLO | Target | Window |
|-----|--------|--------|
| Chat `POST /api/chat` non-5xx | 99.5% | 28d |
| Chat latency p95 | ≤ 5s | 28d |
| Pipeline page TTI | ≤ 2s | 28d |
| Dashboard shell TTFB | ≤ 500ms | 28d |
| API `/api/*` non-5xx excl. 429 | 99.9% | 28d |

Chat availability measures `(total_requests - degraded_responses - 5xx) / total_requests`, not just non-5xx. `chat_degraded_responses_total{tenant_id,reason}` is a counter for chat degraded responses, separate from HTTP 5xx for accurate SLO calculation.
