# ADR-0001 — Recovery redirect uses a stable per-environment base URL, not the ephemeral page origin

**Date**: 2026-07-03
**Status**: Accepted
**Supersedes**: implicit design in `forgot-password/spec.md` Fase 1 (`buildRedirectTo` from `window.location.origin`)

---

## Context

The password-recovery flow (`/forgot-password` → email → `/auth/callback` → `/reset-password`)
builds the `redirectTo` passed to `supabase.auth.resetPasswordForEmail()` from
`window.location.origin` (`frontend/src/app/forgot-password/forgot-password-form.tsx:13-19`).

On a Vercel preview deployment the origin is an ephemeral URL such as
`https://pymepilot-<hash>.vercel.app`. Supabase GoTrue only honours a `redirectTo` that is
present in `GOTRUE_URI_ALLOW_LIST`; an unlisted value is silently replaced by `GOTRUE_SITE_URL`.
Because preview URLs change on every deploy and cannot be allowlisted, the email link ends up
pointing to a different deployment (prod, or whatever `GOTRUE_SITE_URL` is) than the preview the
user submitted from. The recovery round-trip is broken for any non-stable deployment.

The root cause is **not** a Supabase misconfiguration — it is the frontend deriving `redirectTo`
from a source (`window.location.origin`) that is not durable and not allowlistable.

## Options considered

### A — Keep deriving `redirectTo` from `window.location.origin` (status quo)
- **Pros:** zero effort; "works" for the single preview you happen to be on, if you manually
  allowlist that one URL.
- **Cons:** preview URLs are ephemeral (new hash per deploy/branch), so they can never be in the
  allowlist. GoTrue silently falls back to `GOTRUE_SITE_URL`, producing the exact mismatch
  reported. Links outlive the preview that generated them → guaranteed link rot. This **is** the
  bug, not a fix.
- **Verdict:** rejected.

### B — Stable per-environment base URL via env var (recommended)
`buildRedirectTo()` reads `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL` and appends `/auth/callback`.
Each environment sets its own stable value:
- prod → `https://app.pymepilot.cloud`
- staging/dev → `https://dev.pymepilot.cloud` (or the stable alias used)
- local → `http://localhost:3000`

GoTrue's `GOTRUE_URI_ALLOW_LIST` contains every stable environment domain + `/auth/callback`.
- **Pros:** the email link always resolves to a durable, allowlisted origin; the same code path
  works on previews, local, staging, and prod without branching; the allowlist stays small and
  static; previews can still test the form UI — only the email *destination* is pinned to the
  stable environment, which is correct because the link must outlive the preview.
- **Cons:** requires one new env var per environment and a one-time GoTrue allowlist update.
  Testing the full email round-trip on a preview lands the user on the stable staging domain
  (not back on the preview) — acceptable, since the preview and staging share the same code.
- **Verdict:** accepted.

### C — Always redirect to production, regardless of where the form was submitted
Hardcode `redirectTo` to `https://app.pymepilot.cloud/auth/callback` everywhere.
- **Pros:** simplest; one allowlist entry; links always work.
- **Cons:** a developer testing recovery on a dev/staging preview is sent to **prod** to complete
  the flow, exercising different code than the preview. A recovery token for a prod account is
  consumable only on prod (fine), but you lose the ability to test the recovery flow against a
  non-prod Supabase/GoTrue instance. Couples dev/test to prod auth — undesirable and a
  cross-environment hazard.
- **Verdict:** rejected for general use; acceptable only as a degenerate case of B when a project
  has a single environment.

## Decision

Adopt **Option B**. `redirectTo` is derived from a single `NEXT_PUBLIC_*` env var, never from
`window.location.origin`. The env var is set per environment and points to a stable, allowlisted
origin. GoTrue's `GOTRUE_URI_ALLOW_LIST` is updated to include every environment's
`<origin>/auth/callback`.

## Consequences

- `buildRedirectTo()` no longer depends on the browser origin; it is deterministic per build.
- The existing unit test (`page.test.tsx:63`) that asserts
  `http://localhost:3000/auth/callback` must be updated to set the env var instead of
  `window.location.origin`.
- GoTrue config (`GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`) must be reconciled with the env
  var values — they must agree, or GoTrue will silently override the redirect.
- Previews can no longer "self-direct" recovery links; this is intentional and correct.