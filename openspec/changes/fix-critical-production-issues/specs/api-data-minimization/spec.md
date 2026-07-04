# API Data Minimization Specification

## Purpose

Prevent internal identifiers, PII, and inference metadata from leaking through API response payloads. Apply response filtering, per-endpoint rate limiting, and multi-tenant enforcement so the frontend only receives the fields it renders.

## Observability Contract

This domain SHALL emit all metrics, structured log events, and audit signals defined in `observability-foundation`. Specific signals include: RED metrics per endpoint with tenant_id label, rate-limit exceedance logs and audit events, cross-tenant probing audit events, and unauthenticated access audit events.

## Requirements

### Requirement: Response Payload Filtering

Every API endpoint MUST filter its response payload to exclude internal identifiers and PII that the frontend does not render. The system SHALL define an allowlist of fields per endpoint.

#### Scenario: Pipeline endpoint excludes internal IDs

- GIVEN an authenticated request to `GET /api/pipeline`
- WHEN the server constructs the response
- THEN `tenant_id`, `prediction_id`, and `vertical_version` MUST NOT appear in the JSON payload
- AND `confidence_factors` MUST NOT appear in the JSON payload
- AND only `id`, `customer_name`, `stage`, `last_contact`, `suggested_action`, and `status` fields SHALL remain

#### Scenario: Key-accounts endpoint excludes PII

- GIVEN an authenticated request to `GET /api/key-accounts`
- WHEN the server constructs the response
- THEN `customer_email` and `customer_phone` MUST NOT appear in the JSON payload
- AND `tenant_id` MUST NOT appear
- AND the response SHALL include only name, score, days_since_last_purchase, and trend indicator

#### Scenario: Notes endpoint excludes note content PII

- GIVEN an authenticated request to `GET /api/pipeline/notes`
- WHEN the server constructs the response
- THEN full `note_text` MUST NOT be included
- AND only a truncated summary (max 150 chars) SHALL be returned, with PII-like patterns redacted

### Requirement: Tenant Validation Server-Side

The system MUST resolve the tenant identity exclusively from the authenticated session (JWT or server-side cookie). API endpoints MUST NOT accept `tenant_id` as a query parameter, body field, or header for data operations.

#### Scenario: Tenant resolved from session, not request

- GIVEN an authenticated user from tenant A
- WHEN they call `GET /api/pipeline?tenant_id=<tenant-B-uuid>`
- THEN the system SHALL ignore the query parameter
- AND filter data by the tenant from the authenticated session
- AND return HTTP 200 with only tenant A's data

#### Scenario: Unauthenticated request rejected

- GIVEN a request without a valid session token
- WHEN any `/api/*` endpoint is called
- THEN the system SHALL return HTTP 401
- AND the response body SHALL NOT disclose whether the tenant exists

### Requirement: Per-Endpoint Rate Limiting

The system MUST enforce rate limits on all public API endpoints. Limits SHALL be configurable per endpoint and SHALL apply per authenticated user (not per IP).

#### Scenario: User within rate limit

- GIVEN a rate limit of 30 req/min on `GET /api/pipeline`
- WHEN a user makes 25 requests in one minute
- THEN all requests SHALL return normally

#### Scenario: User exceeds rate limit

- GIVEN a rate limit of 30 req/min on `GET /api/pipeline`
- WHEN a user makes 31 requests in one minute
- THEN the 31st request SHALL return HTTP 429
- AND the response SHALL include a `Retry-After` header
- AND the body SHALL contain a user-friendly message: "Demasiadas solicitudes. Esperá {N} segundos."

#### Scenario: Rate limit is per-tenant, not global

- GIVEN Tenant A has exceeded their rate limit
- WHEN Tenant B makes a request to the same endpoint
- THEN Tenant B's request SHALL NOT be rate-limited by Tenant A's usage

### Requirement: Structured Error Responses

All API error responses MUST follow a consistent structure. Error bodies SHALL include `error` (machine-readable code), `message` (user-facing text), and MUST NOT include stack traces, internal hostnames, or file paths.

#### Scenario: Standard error response format

- GIVEN any API endpoint returns an error
- THEN the response body SHALL conform to `{"error": "ERROR_CODE", "message": "Human-readable text"}`
- AND the body MUST NOT contain `stack`, `trace`, `host`, or `file` fields

### Requirement: Observability and Audit Signal Emission

The system MUST emit the observability signals and audit events required by the `observability-foundation` specification. Every rate-limit decision, tenant validation, and security-relevant access SHALL produce structured log events and audit records.

#### Scenario: Rate limit exceeded emits metric and audit log

- GIVEN a request exceeds the rate limit for an endpoint
- WHEN HTTP 429 is returned
- THEN a structured log with `event: "rate_limit.exceeded"` SHALL be emitted containing `tenant_id`, `endpoint`, `limit`, and `window`
- AND an audit event with `action: "rate_limit.exceeded"` SHALL be emitted with `actor.{user_id,tenant_id}`, `resource.endpoint`, and `severity: "WARNING"`

#### Scenario: Cross-tenant probing emits audit event

- GIVEN an authenticated user from tenant A calls `GET /api/pipeline?tenant_id=<tenant-B-uuid>`
- WHEN the system resolves tenant from session and returns 200 with tenant A's data
- THEN an audit event with `action: "tenant_isolation.probe_attempted"` SHALL be emitted containing `actor.{user_id,tenant_id}`, `resource.attempted_tenant_id`, and `result: "blocked"`
- AND the event SHALL include the request's `correlation_id`

#### Scenario: Unauthenticated access emits audit event

- GIVEN a request without a valid session token
- WHEN HTTP 401 is returned
- THEN an audit event with `action: "auth.access_denied"` SHALL be emitted containing `resource.endpoint`, `context.ip_hash` (hashed, not raw), and `correlation_id`

#### Scenario: Every API response increments RED metrics

- GIVEN any request to `/api/*`
- WHEN the response is sent
- THEN `http_requests_total{endpoint, method, status_code, tenant_id}` SHALL increment
- AND `http_request_duration_seconds{endpoint, method, tenant_id}` SHALL record the latency
