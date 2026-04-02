# File index for reconstruction

This index tells Codex what to read first in the legacy repo and why.
It is ordered by migration value, not by folder convenience.

## P0 - Backend critical path

1. `backend/main.py`
   - Daily orchestrator and pipeline order.
2. `backend/config/settings.py`
   - Environment-backed runtime settings and feature flags.
3. `backend/engine/claude/client.py`
   - Anthropic client wrapper, retries and token accounting.
4. `backend/engine/model_context.py`
   - Model routing context and logging contract.
5. `backend/engine/model_router.py`
   - Model selection policy and escalation rules.
6. `backend/engine/db/connection.py`
   - Tenant-aware connection setup and pool behavior.
7. `backend/engine/db/queries.py`
   - SQL contracts that define the business behavior.
8. `backend/engine/connectors/base.py`
   - Connector abstraction and shared interface.
9. `backend/engine/connectors/contabilium.py`
   - ERP sync path for the production tenant.
10. `backend/engine/connectors/excel.py`
   - File ingestion path for non-API tenants.
11. `backend/engine/connectors/smart.py`
   - Smart upload / parsing flow.
12. `backend/engine/connectors/sync.py`
    - Sync orchestration and upsert behavior.
13. `backend/engine/connectors/crypto.py`
    - Credential encryption and tenant secrets handling.
14. `backend/config/prompts/asesor_chat.txt`
    - Assistant prompt contract.
15. `backend/config/prompts/smart_upload.txt`
    - Smart upload prompt contract.
16. `backend/config/prompts/seguimiento/reposicion.txt`
    - Main vertical prompt contract.
17. `backend/config/prompts/seguimiento/activacion.txt`
    - Activation prompt contract.
18. `backend/config/prompts/seguimiento/recuperacion.txt`
    - Recovery prompt contract.
19. `backend/config/prompts/seguimiento/cross_sell.txt`
    - Cross-sell prompt contract.
20. `backend/engine/seguimiento/__init__.py`
    - Registry of active verticals.
21. `backend/engine/seguimiento/base.py`
    - Vertical template contract.
22. `backend/engine/seguimiento/reposicion.py`
    - Core prediction logic for the main vertical.
23. `backend/engine/seguimiento/activacion.py`
    - Activation flow for new customers.
24. `backend/engine/seguimiento/recuperacion.py`
    - Recovery flow for inactive customers.
25. `backend/engine/seguimiento/cross_sell.py`
    - Complementary product recommendations.
26. `backend/engine/core/env_guard.py`
    - Environment validation and runtime safety.
27. `backend/engine/core/logger.py`
    - Sanitized logging contract.
28. `backend/engine/push/sender.py`
    - Push delivery path.
29. `backend/scripts/create_tenant.py`
    - Tenant onboarding and auth fallback logic.
30. `backend/scripts/sync_erp.py`
    - Manual sync entrypoint and validation flags.
31. `backend/scripts/run_vertical.py`
    - Single-vertical execution entrypoint.
32. `backend/scripts/run_attribution.py`
    - Attribution measurement.
33. `backend/scripts/route_model.py`
    - CLI gateway for model routing decisions.
34. `backend/scripts/process_uploads.py`
    - Upload worker behavior.
35. `backend/scripts/cron_wrapper.py`
    - Shared wrapper for cron entrypoints.
36. `backend/scripts/check_data_freshness.py`
    - Data freshness health check.
37. `backend/scripts/setup_credentials.py`
    - Credential bootstrap and key setup.
38. `backend/scripts/generate_service_role_jwt.py`
    - Service-role JWT generation helper.
39. `backend/scripts/sync_google_drive.py`
    - Google Drive sync path.
40. `backend/scripts/test_connection.py`
    - Connectivity smoke test.
41. `backend/scripts/generate_test_excel.py`
    - Local test data generator.
42. `backend/scripts/test_regression_012.py`
    - Legacy regression helper.
43. `backend/tests/test_main_orchestrator.py`
    - Regression coverage for pipeline order.
44. `backend/tests/test_db_queries.py`
    - Regression coverage for query contracts.
45. `backend/tests/test_model_router.py`
    - Regression coverage for model routing.
46. `backend/tests/test_model_context.py`
    - Regression coverage for context formatting.
47. `backend/tests/test_create_tenant_auth_fallback.py`
    - Regression coverage for auth fallback.
48. `backend/tests/test_seguimiento_prompts.py`
    - Regression coverage for prompt loading.

## P1 - Database and migrations

1. `database/migrations/001_010_*`
   - Foundation: extensions, tenants, profiles, customers, products, orders.
2. `database/migrations/011_017_*`
   - RLS, permissions and multi-tenant hardening.
3. `database/migrations/018_024_*`
   - Upload jobs, notifications, orchestrator.
4. `database/migrations/025_031_*`
   - KPI RPCs, security tightening, tenant access fixes.
5. `database/migrations/032_040_*`
   - Monitoring, security debt fixes, achievements, push subscriptions.
6. `database/migrations/041_057_*`
   - Pipeline, stage messages, product rankings, branding, key accounts, platform modules.
7. `database/tests/tenant_isolation_test.sql`
   - A direct SQL check for multi-tenant isolation.

## P2 - Frontend and product surface

1. `frontend/src/middleware.ts`
   - Auth and route protection.
2. `frontend/src/lib/supabase/client.ts`
   - Client-side Supabase access.
3. `frontend/src/lib/supabase/server.ts`
   - Server-side Supabase access.
4. `frontend/src/lib/supabase/middleware.ts`
   - Session refresh and auth bridge.
5. `frontend/src/lib/products/current-product.ts`
   - Current product selection.
6. `frontend/src/lib/products/mayoristas.ts`
   - Segment contract for the active product.
7. `frontend/src/lib/products/types.ts`
   - Product typing contract.
8. `frontend/src/app/(dashboard)/layout.tsx`
   - Dashboard shell and authenticated surface.
9. `frontend/src/app/(dashboard)/page.tsx`
   - Main dashboard landing route.
10. `frontend/src/app/(dashboard)/pipeline/page.tsx`
    - Pipeline product surface.
11. `frontend/src/app/(dashboard)/metricas/page.tsx`
    - Metrics surface.
12. `frontend/src/app/(dashboard)/cuentas-clave/page.tsx`
    - Key accounts surface.
13. `frontend/src/app/(dashboard)/datos/page.tsx`
    - Data / upload surface.
14. `frontend/src/app/(dashboard)/guia/page.tsx`
    - Product guidance surface.
15. `frontend/src/app/(dashboard)/asesor/page.tsx`
    - Assistant/chat surface.
16. `frontend/src/app/api/chat/route.ts`
    - AI assistant API surface.
17. `frontend/src/app/api/pipeline/route.ts`
    - Pipeline API surface.
18. `frontend/src/app/api/key-accounts/route.ts`
    - Key accounts API surface.
19. `frontend/src/components/layout/*`
    - Global navigation, brand and shell.
20. `frontend/src/components/pipeline/*`
    - Core pipeline UI.
21. `frontend/src/components/key-accounts/*`
    - Key account detail and actions.
22. `frontend/src/components/chat/*`
    - Assistant UI.
23. `frontend/src/remotion/*`
    - Onboarding and walkthrough compositions.
24. `frontend/src/app/globals.css`
    - Design system and visual defaults.

## P3 - Docs and operations

1. `docs/ARCHITECTURE.md`
2. `docs/PROJECT_STATE.md`
3. `docs/ONBOARDING.md`
4. `docs/ROADMAP.md`
5. `docs/MODEL_ROUTING.md`
6. `docs/CONTABILIUM_API.md`
7. `docs/modules/*.md`
8. `docs/products/*.md`
9. `docs/handoffs/*.md`
10. `docs/plans/*.md`
11. `grafana/**`
12. `database/seed/dev_data.sql`
13. `.env.example`

## P4 - Build and deployment scaffolding

1. `backend/requirements.txt`
   - Python dependency set for the backend.
2. `frontend/package.json`
   - Frontend dependency and script contract.
3. `frontend/package-lock.json`
   - Locked frontend dependency graph.
4. `frontend/next.config.ts`
   - Next.js runtime config.
5. `frontend/tsconfig.json`
   - TypeScript compile contract.
6. `frontend/Dockerfile`
   - Container build for the frontend.
7. `frontend/docker-compose.yml`
   - Local compose contract for the frontend.
8. `frontend/deploy.sh`
   - Deployment helper script.
9. `frontend/src/app/layout.tsx`
   - Root application shell.
10. `frontend/src/app/globals.css`
    - Global styles and tokens.
11. `frontend/src/app/login/page.tsx`
    - Login entry surface.
12. `frontend/src/components/ui/*`
    - Base reusable UI primitives.
13. `frontend/src/lib/chat/*`
    - Chat tool and type contracts.
14. `frontend/src/lib/pipeline/types.ts`
    - Pipeline data contract.

## How to use this index

- Read P0 first when touching backend behavior.
- Read P1 before any schema, RLS or migration change.
- Read P2 before touching authenticated UI or product routing.
- Read P3 only after the contract is already understood.
