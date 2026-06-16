# Tasks: Fix Critical Production Issues (Block 1)

## Review Workload Forecast

Estimated changed lines: ~1200-1500 (24 files)
400-line budget risk: High
Chained PRs recommended: Yes
Suggested split: PR 1 → PR 2 → PR 3 → PR 4
Delivery strategy: ask-always
Chain strategy: TBD

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Work units: (1) Observability+audit → PR 1, (2) Chat resilience → PR 2, (3) API minimization → PR 3, (4) RSC prefetch → PR 4

## Phase 1: Observability Foundation (PR 1)

- [x] 1.1 **RED** Test correlation ID in `middleware.ts`
- [x] 1.2 **GREEN** Implement UUID v4, `X-Correlation-ID` header
- [x] 1.3 **RED** Test pino schema in `frontend/src/lib/observability/logger.ts`
- [x] 1.4 **GREEN** Implement pino JSON logger
- [x] 1.5 **RED** Test metrics in `frontend/src/lib/observability/metrics.ts`
- [x] 1.6 **GREEN** Implement prom-client registry
- [x] 1.7 **RED** Test `/api/metrics` in `frontend/src/app/api/metrics/route.ts`
- [x] 1.8 **GREEN** Implement `/api/metrics` endpoint
- [x] 1.9 **RED** Test audit_log in `backend/supabase/migrations/XXX_audit_log.sql`
- [x] 1.10 **GREEN** Create audit_log, INSERT-only, ip_hash
- [x] 1.11 **RED** Test `emitAudit()` in `frontend/src/lib/audit.ts`
- [x] 1.12 **GREEN** Implement `emitAudit()` with hashed IPs
- [x] 1.13 **RED** Test JSONFormatter in `backend/engine/core/logger.py`
- [x] 1.14 **GREEN** Implement JSONFormatter

## Phase 2: Chat Resilience (PR 2)

- [x] 2.1 **RED** Test CB (5/10 fail, 60s half-open, per-tenant) in `frontend/src/lib/chat/circuit-breaker.ts`
- [x] 2.2 **GREEN** Implement opossum CB per tenant
- [x] 2.3 **RED** Test wrapper (30s timeout, 3 retries, 429 no-retry) in `frontend/src/lib/chat/resilience.ts`
- [x] 2.4 **GREEN** Implement timeout+retry+CB
- [x] 2.5 **REFACTOR** Wrap `frontend/src/app/api/chat/route.ts` with resilience
- [x] 2.6 **RED** Test `GET /api/health` in `frontend/src/app/api/health/route.ts`
- [x] 2.7 **GREEN** Implement `/api/health` with circuit state
- [x] 2.8 **RED** Test chat-context error parsing in `frontend/src/contexts/chat-context.tsx`
- [x] 2.9 **GREEN** Update chat-context with retry callback
- [x] 2.10 **RED** Test retry button in `frontend/src/components/chat/chat-panel.tsx`
- [x] 2.11 **GREEN** Update chat-panel with conditional retry

## Phase 3: API Data Minimization (PR 3)

- [x] 3.1 **RED** Test `filterResponse()` in `frontend/src/lib/response-filter.ts`
- [x] 3.2 **GREEN** Implement allowlist field stripping
- [x] 3.3 **REFACTOR** Apply filter to `pipeline/route.ts`
- [x] 3.4 **REFACTOR** Apply filter to `key-accounts/route.ts`
- [x] 3.5 **REFACTOR** Update `pipeline/notes/route.ts` — truncate, redact PII
- [x] 3.6 **RED** Test rate limiter in `frontend/src/lib/rate-limit.ts`
- [x] 3.7 **GREEN** Implement lru-cache per-user
- [x] 3.8 **REFACTOR** Wire rate limiter into `middleware.ts`
- [x] 3.9 **REFACTOR** Enforce session-only tenant, emit probe audit

## Phase 4: RSC Prefetch Optimization (PR 4)

- [x] 4.1 **RED** Test prefetch detection in `frontend/src/lib/supabase/middleware.ts`
- [x] 4.2 **GREEN** Update supabase middleware — skip getUser on prefetch
- [x] 4.3 **RED** Test cache wrappers in `frontend/src/lib/cache.ts`
- [x] 4.4 **GREEN** Implement React.cache + unstable_cache (60s SWR)
- [x] 4.5 **REFACTOR** Apply caching to `dashboard/layout.tsx`
- [x] 4.6 **REFACTOR** Apply caching + Suspense to `dashboard/page.tsx`
- [x] 4.7 **REFACTOR** Apply caching + SWR to `dashboard/pipeline/page.tsx`
- [x] 4.8 **REFACTOR** Update `next.config.ts` — maxDuration, regions
