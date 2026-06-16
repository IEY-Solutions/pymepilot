# RSC Prefetch Optimization Specification

## Purpose

Eliminate 503 errors during RSC prefetches and reduce per-request latency. Middleware SHALL skip expensive auth round-trips on prefetch, data fetches SHALL use per-request deduplication and tenant-scoped caching, and routes SHALL enforce maxDuration with graceful degradation via Suspense.

## Observability Contract

This domain SHALL emit all metrics, structured log events, and signals defined in `observability-foundation`. Specific signals include: RSC prefetch counters and latency histograms per route, auth validation latency histograms by type (full vs prefetch), cache hit ratio gauges per operation, and maxDuration breach events.

## Requirements

### Requirement: Middleware Skips Expensive Auth for Prefetch

The middleware MUST distinguish RSC prefetch requests from full navigations (via `Purpose: prefetch` or `Next-RSC` header). On prefetch, it SHALL validate the session cookie locally without calling `auth.getUser()`. On full navigation, it SHALL validate the session fully.

#### Scenario: Prefetch avoids GoTrue round-trip

- GIVEN a user has a valid session cookie
- WHEN Next.js issues an RSC prefetch request
- THEN middleware SHALL validate locally in under 5ms without calling `auth.getUser()`

#### Scenario: Full navigation validates session

- GIVEN a user performs a full page load
- WHEN middleware processes the request
- THEN middleware SHALL call `auth.getUser()` and reject with 401 if invalid

### Requirement: Data Fetch Deduplication and Caching

The system SHALL deduplicate identical in-request fetches via `React.cache`. Repeated cross-request data SHALL use stale-while-revalidate caching with tenant-scoped keys and configurable TTL.

#### Scenario: Multiple components share one fetch

- GIVEN a dashboard page with three components fetching pipeline data
- WHEN the page renders server-side
- THEN the fetch SHALL execute exactly once per request and all components SHALL share the result

#### Scenario: Stale data served during background revalidation

- GIVEN pipeline data was cached with a 60s TTL, 30s ago
- WHEN a new request arrives
- THEN stale data SHALL be returned immediately and revalidation SHALL run in the background

### Requirement: Execution Time Limits with Graceful Degradation

The system MUST enforce `maxDuration` on server-rendered routes. Routes exceeding budget SHALL send whatever HTML was generated rather than a 503. Dashboard pages MUST wrap data-dependent components in Suspense boundaries with skeleton fallbacks, allowing the shell to render immediately.

#### Scenario: Route exceeds budget, partial render sent

- GIVEN pipeline page with `maxDuration: 30s`
- WHEN data fetches exceed 30s
- THEN the server SHALL send already-generated HTML with skeleton placeholders for slow components

#### Scenario: Dashboard streams progressively

- GIVEN the home page has three data sections
- WHEN the page is requested
- THEN the layout shell SHALL render within 500ms and each section SHALL stream independently as its data resolves

#### Scenario: Single component failure isolates error

- GIVEN a Suspense-wrapped component's data fetch fails
- WHEN the boundary catches the error
- THEN only that component SHALL render `error.tsx`; other components and the page status SHALL remain unaffected

### Requirement: Prefetch Failure Tolerance

When an RSC prefetch fails, the system SHALL NOT cache the error response. Client-side navigation SHALL issue a fresh full request, and the user SHALL see the page or a per-component error — never a blank screen or 503.

#### Scenario: Prefetch fails, navigation retries fresh

- GIVEN an RSC prefetch for `/pipeline` times out
- WHEN the user clicks the Pipeline link
- THEN the client SHALL issue a fresh full navigation that renders normally on success

### Requirement: Observability Signal Emission

The system MUST emit the observability signals required by the `observability-foundation` specification. Every prefetch request, cache operation, auth validation, and Suspense boundary resolution SHALL produce structured log events and update Prometheus metrics.

#### Scenario: Prefetch emits RED metrics

- GIVEN an RSC prefetch request for any route
- WHEN the prefetch completes or fails
- THEN `rsc_prefetch_total{route, status}` counter SHALL increment
- AND `rsc_prefetch_duration_seconds{route, quantile}` histogram SHALL record the latency

#### Scenario: Auth validation emits latency metric

- GIVEN any auth validation in middleware or layout
- WHEN the validation completes
- THEN `auth_validation_duration_seconds{type}` histogram SHALL record the latency — type SHALL be `full` for `getUser()` calls and `prefetch` for local cookie validation

#### Scenario: Cache operation updates hit ratio

- GIVEN a stale-while-revalidate cache operation
- WHEN the cache is queried
- THEN `cache_hit_ratio{operation}` gauge SHALL update — operation SHALL be the cache key prefix (e.g., `pipeline`, `key-accounts`)
- AND a cache miss that triggers background revalidation SHALL NOT count as a hit

#### Scenario: Route maxDuration breach logged

- GIVEN a route exceeds its `maxDuration` budget
- WHEN the server sends partial HTML with skeleton placeholders
- THEN a structured log with `event: "route.max_duration_breached"` SHALL be emitted containing `route`, `duration_ms`, `max_duration_ms`, `tenant_id`, and `correlation_id`
- AND `http_requests_total{status_code="partial"}` or equivalent SHALL increment to distinguish from full 503
