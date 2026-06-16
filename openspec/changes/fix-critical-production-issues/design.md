# Design: Fix Critical Production Issues — Block 1

## Technical Approach

Four defense layers on the Next.js API surface, all emitting shared `observability-foundation` signals: (1) chat resilience via timeout/retry/circuit-breaker wrapping Anthropic calls, (2) API data minimization via server-side allowlist filtering + per-user rate limiting, (3) RSC prefetch optimization via middleware fast-path + `React.cache` + `unstable_cache` SWR + `maxDuration`, (4) correlation IDs, JSON logging, Prometheus metrics, and append-only audit table.

## Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Circuit breaker | **opossum** — per-tenant LRU instances, 5 fail / 10 window / 60s half-open | Mature library, less code than custom state machine |
| Prometheus | **prom-client** (Next.js) + **prometheus_client** (Python) | Standard library, histogram support, `/metrics` built-in |
| Correlation ID | **UUID v4 in middleware** → `X-Correlation-ID` header + log context | Single origin point, crosses Next.js→Python→Anthropic |
| Logging | **pino** (Next.js) + **custom JSONFormatter** extending SanitizingFormatter (Python) | JSON-native, preserves secret redaction pipeline |
| Rate limiting | **lru-cache** in-memory, per-user | Zero infra, fits single-instance. Redis if scaling. |
| Response filtering | **Server-side allowlist** before `Response.json()` | Single `filterResponse(data, allowlist)`, auditable |
| Caching | **React.cache** (in-request) + **unstable_cache** (60s SWR, tenant keys) | Native Next.js, no extra deps |
| Prefetch skip | **`Next-RSC` header** → local cookie val (<5ms) | Standard Next.js indicator, avoids GoTrue round-trip |
| Audit | **audit_log table** — INSERT-only grant, hashed IPs | Immutable SQL trail, no app mutability |

## Data Flow

```
Browser → Middleware(correlation + rate limit)
  ├─ prefetch? → local cookie val → cache dedup → render
  └─ full? → getUser() → API → allowlist → json
                              ├─ /api/chat → CB → Anthropic (+timeout/retry)
                              └─ /api/*     → rate limiter → audit → metrics
                     
GET /api/health → Anthropic ping GET /api/metrics → prometheus
```

## File Changes

**New (10):**
- `frontend/src/lib/chat/circuit-breaker.ts` — Tenant CB map
- `frontend/src/lib/chat/resilience.ts` — Timeout+retry+CB wrapper
- `frontend/src/lib/response-filter.ts` — Allowlist field stripping
- `frontend/src/lib/rate-limit.ts` — Per-user lru-cache limiter
- `frontend/src/lib/audit.ts` — `emitAudit()` → `audit_log`
- `frontend/src/lib/cache.ts` — `React.cache` + `unstable_cache` wrappers
- `frontend/src/lib/observability/metrics.ts` — prom-client registry
- `frontend/src/lib/observability/logger.ts` — pino JSON logger
- `frontend/src/app/api/health/route.ts` — Anthropic ping + circuit state
- `frontend/src/app/api/metrics/route.ts` — Prometheus text endpoint
- `frontend/middleware.ts` — Correlation ID + rate limit + timing

**Modified (14):**
- `frontend/src/app/api/chat/route.ts` — Wrap in resilience, structured errors, metrics
- `frontend/src/app/api/pipeline/route.ts` — Allowlist filter, session-only tenant
- `frontend/src/app/api/key-accounts/route.ts` — Strip PII, allowlist filter
- `frontend/src/app/api/pipeline/notes/route.ts` — Truncate 150 chars, redact PII
- `frontend/src/lib/supabase/middleware.ts` — Next-RSC header → fast-path
- `frontend/src/app/(dashboard)/layout.tsx` — cache auth + notifications
- `frontend/src/app/(dashboard)/page.tsx` — Suspense + dedup queries
- `frontend/src/app/(dashboard)/pipeline/page.tsx` — cache + SWR
- `frontend/next.config.ts` — `maxDuration: 30`, `regions: ["gru1"]`
- `frontend/src/contexts/chat-context.tsx` — error type parsing, `retry()`
- `frontend/src/components/chat/chat-panel.tsx` — conditional retry button
- `backend/engine/core/logger.py` — JSONFormatter extends SanitizingFormatter
- `backend/supabase/migrations/XXX_audit_log.sql` — Immutable audit table

## Key Interfaces

```typescript
ApiErrorResponse { error: string; message: string; retry_after?: number }
filterResponse<T>(data: T, allowlist: string[]): Partial<T>
CircuitState { tenant_id; state: CLOSED|OPEN|HALF_OPEN; failures; next_probe }
AuditEvent { actor:{user_id,tenant_id}; action; resource; result; correlation_id; severity }
```

## Testing Strategy

| What | How |
|------|-----|
| CB transitions, retry backoff, allowlist filter, rate counter | Unit: Vitest + Python unittest. Mocked SDK, mocked clock |
| Log schema, audit structure, correlation propagation | Unit: assert JSON schema, field presence |
| Chat timeout → degraded HTTP 200 + Spanish msg + metrics | Integration: monkey-patch Anthropic. Verify counters |
| Pipeline/key-accounts/notes response excludes internal fields | Integration: call endpoint, assert keys match allowlist |
| Prefetch skips getUser(), full nav calls it | Integration: `Next-RSC` header test + timing assertion |
| Rate limiter 31st req → 429 + Retry-After | Integration: fast clock, per-user counter |
| Retry button visible on timeout, hidden on 429 | E2E: mock API responses, assert button state |

## Migration

- **audit_log**: forward-only migration, INSERT-only grant
- **maxDuration + Suspense**: progressive, existing routes unaffected
- **Prefetch**: backward-compatible — no `Next-RSC` → full auth
- **Response filtering**: deploy server-side before updating frontend types
- No feature flags needed

## Open Questions

- [ ] Redis rate limiter within 3 months? (check Vercel scaling plan)
- [ ] `unstable_cache` may change in Next 17 — pin version if needed
- [ ] `maxDuration: 30` is initial; profile 1 week, tighten to 15s if safe
