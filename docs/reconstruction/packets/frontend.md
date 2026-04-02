# Frontend packet

## Why this packet exists

The frontend is not where the business logic lives, but it is where the product
surface and routing contract become visible. The new repo should reuse the
working shapes, then simplify the structure only after the backend contract is
stable.

## Read order

1. `frontend/src/middleware.ts`
2. `frontend/src/lib/supabase/client.ts`
3. `frontend/src/lib/supabase/server.ts`
4. `frontend/src/lib/supabase/middleware.ts`
5. `frontend/src/lib/products/current-product.ts`
6. `frontend/src/lib/products/mayoristas.ts`
7. `frontend/src/lib/products/types.ts`
8. `frontend/src/app/(dashboard)/layout.tsx`
9. `frontend/src/app/(dashboard)/page.tsx`
10. `frontend/src/app/(dashboard)/pipeline/page.tsx`
11. `frontend/src/app/(dashboard)/metricas/page.tsx`
12. `frontend/src/app/(dashboard)/cuentas-clave/page.tsx`
13. `frontend/src/app/(dashboard)/datos/page.tsx`
14. `frontend/src/app/(dashboard)/guia/page.tsx`
15. `frontend/src/app/(dashboard)/asesor/page.tsx`
16. `frontend/src/app/api/chat/route.ts`
17. `frontend/src/app/api/pipeline/route.ts`
18. `frontend/src/app/api/key-accounts/route.ts`
19. `frontend/src/components/layout/*`
20. `frontend/src/components/pipeline/*`
21. `frontend/src/components/key-accounts/*`
22. `frontend/src/components/chat/*`
23. `frontend/src/remotion/*`

## Core frontend contracts

- Supabase SSR auth must stay centralized.
- Middleware must keep protected routes protected.
- Product selection must be data-driven, not hard-coded in pages.
- Dashboard surfaces should be thin wrappers over product contracts.
- API routes should expose backend capabilities, not duplicate backend logic.

## Recommended migration shape

- Keep `app/` and route groups if the App Router structure is already good.
- Move shared product decisions into `frontend/src/lib/products/`.
- Keep auth helpers together under `frontend/src/lib/supabase/`.
- Keep UI components grouped by surface, not by abstract atom count.
- Preserve Remotion compositions if they already encode onboarding value.

## What to verify

- Route protection still blocks unauthenticated access.
- The selected product controls which surfaces are shown.
- Dashboard pages still render the expected data contracts.
- API routes still match the backend response shapes.

## What to defer

- Cosmetic refactors that do not improve reconstruction speed.
- Rewriting all UI structure before the backend is stable.
- Splitting components further if there is no contract gain.
