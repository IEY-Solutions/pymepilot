# Chat Resilience Specification

## Purpose

Ensure `POST /api/chat` remains available under degraded upstream conditions via timeout, retry, circuit breaker, and user-facing error surfaces. Never expose raw 502s or misleading generic errors.

## Observability Contract

This domain SHALL emit all metrics, structured log events, and audit signals defined in `observability-foundation`. Specific signals include: circuit breaker state gauge, upstream error counters, retry attempt counters, degraded response counters, and RED metrics for `/api/chat`.

## Requirements

### Requirement: Chat Request Timeout

The system MUST enforce a configurable deadline on every upstream LLM call. If the upstream does not respond before the deadline, the request SHALL be aborted and a degraded response returned.

#### Scenario: Timeout triggers graceful degradation

- GIVEN a valid authenticated chat request
- WHEN the LLM upstream does not respond within 30s
- THEN the system SHALL abort the call and return HTTP 200 with "El asesor no está disponible en este momento. Intentá de nuevo en unos minutos."

### Requirement: Retry with Exponential Backoff

The system MUST retry transient upstream failures (5xx, network timeout) using exponential backoff with jitter, up to 3 attempts. Non-retryable errors (4xx) SHALL fail immediately with a specific message.

#### Scenario: Transient failure retried, exhausted

- GIVEN the upstream returns 503 three consecutive times
- WHEN retries are exhausted
- THEN the system SHALL return the degraded message

#### Scenario: Rate limit not retried

- GIVEN the upstream returns 429
- THEN the system SHALL NOT retry and SHALL return "Límite de consultas alcanzado. Probá más tarde."

### Requirement: Circuit Breaker

The system MUST implement a circuit breaker that opens when 5 of the last 10 calls fail. When open, requests SHALL fail-fast without calling upstream. After a 60s timeout, one probe request SHALL be allowed before re-closing. Circuit state MUST be scoped per tenant.

#### Scenario: Circuit opens, then recovers

- GIVEN the circuit is CLOSED
- WHEN 5 of 10 upstream calls fail → circuit OPEN → subsequent requests fail-fast
- WHEN 60s elapses → circuit HALF-OPEN → one probe succeeds → circuit CLOSED

#### Scenario: Tenant isolation

- GIVEN Tenant A's circuit is OPEN due to rate-limit exhaustion
- WHEN Tenant B makes a chat request
- THEN Tenant B's request SHALL succeed if the upstream is healthy

### Requirement: Health Check

The system SHOULD expose `GET /api/health` returning `llm_upstream` with status `healthy`, `degraded`, or `unhealthy`, plus circuit state and last check timestamp.

#### Scenario: Health reflects circuit state

- GIVEN the circuit is OPEN
- WHEN `GET /api/health` is called
- THEN `llm_upstream.status` SHALL be `unhealthy` and `circuit_state` SHALL be `OPEN`

### Requirement: Error Surface

The system MUST map all upstream failures to user-facing Spanish messages. It MUST NOT expose internal hostnames, stack traces, HTTP codes, or environment variables. The chat panel SHALL show a "Reintentar" button on timeout errors and hide it on rate-limit errors (showing retry-after timestamp instead).

#### Scenario: Timeout shows retry button

- GIVEN upstream times out
- THEN chat panel displays degraded message with visible "Reintentar" button

#### Scenario: Rate limit hides retry

- GIVEN upstream returns 429
- THEN chat panel displays rate-limit message with "Reintentar" hidden and a "Disponible a las HH:MM" indicator

### Requirement: Observability Signal Emission

The system MUST emit the observability signals required by the `observability-foundation` specification. Every circuit state transition, upstream call, retry attempt, and timeout SHALL produce structured log events and update Prometheus metrics.

#### Scenario: Circuit transition emits metric and log

- GIVEN the circuit breaker transitions from CLOSED to OPEN
- THEN `chat_circuit_breaker_state{tenant_id}` gauge SHALL update to `0`
- AND a structured log with `event: "circuit_breaker.opened"` SHALL be emitted containing `tenant_id`, `failure_count`, `failure_window`, and `correlation_id`

#### Scenario: Upstream call emits RED metrics

- GIVEN any call to the Anthropic API
- WHEN the call completes or fails
- THEN `http_requests_total{endpoint="/api/chat", status_code, tenant_id}` SHALL increment
- AND `http_request_duration_seconds{endpoint="/api/chat", tenant_id}` histogram SHALL record the latency
- AND `chat_upstream_errors_total{tenant_id, status_code}` SHALL increment on non-2xx responses

#### Scenario: Timeout emits degraded-response metric

- GIVEN the upstream call times out after 30s
- WHEN the degraded HTTP 200 response is returned
- THEN a `chat_degraded_responses_total{tenant_id, reason="timeout"}` counter SHALL increment
- AND this counter SHALL be distinct from HTTP status so SLOs can track true success vs degraded responses
