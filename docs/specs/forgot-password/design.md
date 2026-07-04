# Forgot/Reset Password — Recovery Redirect Design

**ID**: `forgot-password`
**Date**: 2026-07-03
**Status**: Design (supersedes the implicit Fase-1 redirect design in `forgot-password/spec.md`)
**ADR**: [ADR-0001](../../adr/0001-recovery-redirect-stable-base-url.md)

---

## 1. Problem statement

`supabase.auth.resetPasswordForEmail(email, { redirectTo })` requires a `redirectTo` that is
durable and present in GoTrue's `GOTRUE_URI_ALLOW_LIST`. The current implementation derives
`redirectTo` from `window.location.origin`, which on a Vercel preview is an ephemeral URL that
changes per deploy and can never be allowlisted. GoTrue silently substitutes `GOTRUE_SITE_URL`,
so the email link lands on a different deployment than the one the user submitted from. The
recovery round-trip is broken for every non-stable deployment.

## 2. Root cause (traced against real code)

```
forgot-password-form.tsx:13  buildRedirectTo()
  → window.location.origin + "/auth/callback"
  → e.g. https://pymepilot-<hash>.vercel.app/auth/callback   (ephemeral, NOT allowlisted)
forgot-password-form.tsx:59  resetPasswordForEmail(email, { redirectTo })
  → GoTrue: redirectTo not in GOTRUE_URI_ALLOW_LIST
  → GoTrue falls back to GOTRUE_SITE_URL
  → email link points to a DIFFERENT deployment than the preview
auth/callback/page.tsx       completes recovery on whatever origin the link opened
```

The single consumer of `buildRedirectTo()` is `forgot-password-form.tsx:31` (used at `:61`).
The single test asserting its output is `page.test.tsx:63`.

## 3. Design

### 3.1 `redirectTo` source of truth

`redirectTo` is built from one `NEXT_PUBLIC_*` env var, **never** from `window.location.origin`.

```
NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL  →  stable origin per environment
redirectTo = `${NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL}/auth/callback`
```

| Environment | `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL` |
|-------------|--------------------------------------|
| production  | `https://app.pymepilot.cloud`       |
| staging/dev | `https://dev.pymepilot.cloud` (stable alias) |
| local       | `http://localhost:3000`              |

The env var is a full origin (scheme + host), no trailing slash, no path. The `/auth/callback`
suffix is appended in code so the path is not duplicated or omitted by operator error.

### 3.2 Fallback / validation

`buildRedirectTo()` must fail loudly if the env var is missing or malformed, rather than
silently falling back to `window.location.origin` (which would reintroduce the bug). On the
client, a missing `NEXT_PUBLIC_*` var resolves to `undefined`; the function should throw a
descriptive error so the breakage is caught at request time, not silently misdirected.

### 3.3 GoTrue configuration contract

GoTrue and the env var **must agree**. This is the linchpin: if they disagree, GoTrue silently
overrides the redirect and the bug returns.

| GoTrue param | Value |
|--------------|-------|
| `GOTRUE_SITE_URL` | the production origin (`https://app.pymepilot.cloud`) |
| `GOTRUE_URI_ALLOW_LIST` | comma-separated list of every environment's `<origin>/auth/callback` |

Example allowlist:
```
https://app.pymepilot.cloud/auth/callback,https://dev.pymepilot.cloud/auth/callback,http://localhost:3000/auth/callback
```

`GOTRUE_SITE_URL` is the fallback when a `redirectTo` is rejected; it should be the prod origin
so a misconfigured redirect degrades to prod (a working deployment) rather than to an
ephemeral URL.

### 3.4 What does NOT change

- `/auth/callback` page logic (code exchange, hash session, error routing) — unchanged.
- `/reset-password` page — unchanged.
- Middleware public-route allowlist (`/forgot-password`, `/reset-password`, `/auth/callback`) —
  unchanged.
- Anti-enumeration generic message — unchanged.
- Rate limiting — unchanged (Fase 2 concern).

## 4. Implementer contract

### 4.1 `buildRedirectTo()` — `frontend/src/app/forgot-password/forgot-password-form.tsx`

```ts
const AUTH_CALLBACK_PATH = "/auth/callback";

function buildRedirectTo(): string {
  const base = process.env.NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL is not set. " +
      "Recovery redirect cannot be derived from the page origin (ephemeral previews break it)."
    );
  }
  return new URL(AUTH_CALLBACK_PATH, base).toString();
}
```

Invariants the implementer must honor:
- **Never** read `window.location.origin` for `redirectTo`.
- The function is still called once per mount via `useMemo` (preserve current behaviour).
- The thrown error must surface to the user as the existing generic error message
  ("Hubo un problema. Intentá de nuevo.") — do not leak the env-var name to the end user. The
  thrown error is for the developer/operator; the catch block already normalises to the generic
  message.

### 4.2 Test update — `frontend/src/app/forgot-password/page.test.tsx`

The test at line 63 must stub `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL` so the assertion remains
`http://localhost:3000/auth/callback` without depending on `window.location.origin`:

```ts
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
```

The assertion stays `http://localhost:3000/auth/callback` — now sourced from the env var.

### 4.3 Environment files

- `frontend/.env.local` (local dev): add `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL=http://localhost:3000`
- Vercel project env (prod): `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL=https://app.pymepilot.cloud`
- Vercel project env (staging/preview): `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL=https://dev.pymepilot.cloud`
  (or the stable alias chosen for staging)

`NEXT_PUBLIC_*` vars are inlined at build time; each Vercel deployment target gets its own value.

### 4.4 GoTrue config (operator, not code)

Update `GOTRUE_SITE_URL` and `GOTRUE_URI_ALLOW_LIST` in the Supabase docker-compose
(`/opt/orion-stack/`) per §3.3, then restart the `auth` container. This is the prerequisite
verification task — it must pass before implementation is considered done.

## 5. Verification gates (must pass before close)

1. **GoTrue config gate (UNVERIFIED → must confirm):** `GOTRUE_SITE_URL` and
   `GOTRUE_URI_ALLOW_LIST` contain the stable origins from §3.3. Verify by inspecting the
   docker-compose env on the VPS. This is the linchpin — without it, the code change is inert.
2. **Unit test gate:** `page.test.tsx` passes with the env-var-based `buildRedirectTo`.
3. **End-to-end gate (manual, staging):** submit forgot-password on a Vercel preview; the
   email link must point to the **stable** staging origin (`/auth/callback`), not the preview
   origin; clicking it completes recovery on staging.
4. **No-regression gate:** confirm no other consumer of `buildRedirectTo` exists (grep — only
   `forgot-password-form.tsx` and its test reference it).

## 6. Risks if not done

- Recovery links continue to redirect to the wrong deployment on every preview → the feature is
  untestable on previews and appears broken to any reviewer.
- If `GOTRUE_SITE_URL` is also misconfigured, links may point to `localhost` or an internal IP,
  making recovery completely non-functional for end users.
- Silent fallback behaviour in GoTrue means the bug is invisible until a real user clicks the
  link — there is no error surfaced at submit time.
