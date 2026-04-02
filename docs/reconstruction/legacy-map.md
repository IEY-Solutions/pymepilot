# Legacy to new repo map

This map translates the old repo into a cleaner target shape for the new repo.
The target paths are recommendations, not hard constraints, but the migration
mode and contract should remain stable.

## Backend

| Legacy path | Suggested new path | Mode | Contract |
| --- | --- | --- | --- |
| `backend/main.py` | `backend/app/orchestrator.py` | refactor | Keep pipeline order and orchestration semantics. |
| `backend/config/settings.py` | `backend/core/config/settings.py` | copy/refactor | Preserve env-backed settings and feature flags. |
| `backend/engine/claude/client.py` | `backend/core/ai/claude/client.py` | copy/refactor | Preserve LLM wrapper, retries and token accounting. |
| `backend/engine/model_context.py` | `backend/core/modeling/context.py` | copy/refactor | Preserve routing context formatting. |
| `backend/engine/model_router.py` | `backend/core/modeling/router.py` | copy/refactor | Preserve escalation policy and retry budget. |
| `backend/engine/db/connection.py` | `backend/core/db/connection.py` | copy | Preserve tenant-aware connection setup. |
| `backend/engine/db/queries.py` | `backend/core/db/queries.py` | copy/refactor | Preserve SQL contracts and row-shape assumptions. |
| `backend/engine/connectors/base.py` | `backend/integrations/erp/base.py` | copy | Preserve connector interface. |
| `backend/engine/connectors/contabilium.py` | `backend/integrations/erp/contabilium.py` | copy/refactor | Preserve read-only sync behavior. |
| `backend/engine/connectors/excel.py` | `backend/integrations/erp/excel.py` | copy/refactor | Preserve spreadsheet ingestion behavior. |
| `backend/engine/connectors/smart.py` | `backend/integrations/erp/smart_upload.py` | refactor | Preserve parsing and fallback semantics. |
| `backend/engine/connectors/sync.py` | `backend/integrations/erp/sync.py` | copy | Preserve upsert and sync_log behavior. |
| `backend/engine/connectors/crypto.py` | `backend/core/security/crypto.py` | copy | Preserve encryption contract for ERP creds. |
| `backend/config/prompts/asesor_chat.txt` | `backend/config/prompts/asesor_chat.txt` | copy | Preserve assistant prompt contract. |
| `backend/config/prompts/smart_upload.txt` | `backend/config/prompts/smart_upload.txt` | copy | Preserve smart upload prompt contract. |
| `backend/config/prompts/seguimiento/*` | `backend/config/prompts/seguimiento/*` | copy | Preserve vertical prompt contracts. |
| `backend/engine/seguimiento/__init__.py` | `backend/modules/seguimiento/__init__.py` | copy | Preserve registry of verticals. |
| `backend/engine/seguimiento/base.py` | `backend/modules/seguimiento/base.py` | copy | Preserve template-method contract. |
| `backend/engine/seguimiento/reposicion.py` | `backend/modules/seguimiento/reposicion.py` | copy/refactor | Preserve candidate selection and prompt contract. |
| `backend/engine/seguimiento/activacion.py` | `backend/modules/seguimiento/activacion.py` | copy/refactor | Preserve activation rules. |
| `backend/engine/seguimiento/recuperacion.py` | `backend/modules/seguimiento/recuperacion.py` | copy/refactor | Preserve inactivity windows and logic. |
| `backend/engine/seguimiento/cross_sell.py` | `backend/modules/seguimiento/cross_sell.py` | copy/refactor | Preserve co-purchase logic. |
| `backend/engine/core/env_guard.py` | `backend/core/runtime/env_guard.py` | copy | Preserve runtime validation. |
| `backend/engine/core/logger.py` | `backend/core/runtime/logger.py` | copy | Preserve secret redaction. |
| `backend/engine/push/sender.py` | `backend/integrations/push/sender.py` | copy/refactor | Preserve delivery behavior. |
| `backend/scripts/create_tenant.py` | `scripts/create_tenant.py` | copy/refactor | Preserve onboarding and auth fallback behavior. |
| `backend/scripts/sync_erp.py` | `scripts/sync_erp.py` | copy | Preserve sync CLI semantics. |
| `backend/scripts/run_vertical.py` | `scripts/run_vertical.py` | copy | Preserve execution flags and dry-run behavior. |
| `backend/scripts/run_attribution.py` | `scripts/run_attribution.py` | copy | Preserve attribution measurement. |
| `backend/scripts/route_model.py` | `scripts/route_model.py` | copy | Preserve routing gateway behavior. |
| `backend/scripts/process_uploads.py` | `scripts/process_uploads.py` | copy/refactor | Preserve worker semantics. |
| `backend/scripts/cron_wrapper.py` | `scripts/cron_wrapper.py` | copy | Preserve shared cron wrapper behavior. |
| `backend/scripts/check_data_freshness.py` | `scripts/check_data_freshness.py` | copy | Preserve freshness checks. |
| `backend/scripts/setup_credentials.py` | `scripts/setup_credentials.py` | copy | Preserve credential bootstrap flow. |
| `backend/scripts/generate_service_role_jwt.py` | `scripts/generate_service_role_jwt.py` | copy | Preserve service-role JWT helper. |
| `backend/scripts/sync_google_drive.py` | `scripts/sync_google_drive.py` | copy/refactor | Preserve Drive sync behavior. |

## Database

| Legacy path | Suggested new path | Mode | Contract |
| --- | --- | --- | --- |
| `database/migrations/001_010_*` | `database/migrations/` | copy | Preserve base schema and data model. |
| `database/migrations/011_017_*` | `database/migrations/` | copy | Preserve RLS and multi-tenant security. |
| `database/migrations/018_024_*` | `database/migrations/` | copy | Preserve uploads, orchestration and operational tables. |
| `database/migrations/025_031_*` | `database/migrations/` | copy | Preserve KPI and access hardening contracts. |
| `database/migrations/032_040_*` | `database/migrations/` | copy | Preserve monitoring and security fixes. |
| `database/migrations/041_057_*` | `database/migrations/` | copy/refactor | Preserve pipeline, key accounts and platform modules. |
| `database/tests/tenant_isolation_test.sql` | `database/tests/tenant_isolation_test.sql` | copy | Preserve direct isolation validation. |

## Frontend

| Legacy path | Suggested new path | Mode | Contract |
| --- | --- | --- | --- |
| `frontend/src/middleware.ts` | `frontend/src/middleware.ts` | copy | Preserve auth protection. |
| `frontend/src/lib/supabase/*` | `frontend/src/lib/supabase/*` | copy | Preserve client/server/middleware auth bridge. |
| `frontend/src/lib/products/*` | `frontend/src/lib/products/*` | copy/refactor | Preserve product and segment contract. |
| `frontend/src/app/(dashboard)/*` | `frontend/src/app/(dashboard)/*` | refactor | Preserve routes but simplify layout if needed. |
| `frontend/src/app/api/chat/route.ts` | `frontend/src/app/api/chat/route.ts` | copy/refactor | Preserve assistant API contract. |
| `frontend/src/app/api/pipeline/route.ts` | `frontend/src/app/api/pipeline/route.ts` | copy/refactor | Preserve pipeline API contract. |
| `frontend/src/components/layout/*` | `frontend/src/components/layout/*` | copy/refactor | Preserve brand, shell and navigation. |
| `frontend/src/components/pipeline/*` | `frontend/src/components/pipeline/*` | copy/refactor | Preserve board and interaction behavior. |
| `frontend/src/components/key-accounts/*` | `frontend/src/components/key-accounts/*` | copy/refactor | Preserve key account detail flows. |
| `frontend/src/components/chat/*` | `frontend/src/components/chat/*` | copy/refactor | Preserve assistant UI. |
| `frontend/src/remotion/*` | `frontend/src/remotion/*` | copy | Preserve onboarding compositions. |

## Operations and docs

| Legacy path | Suggested new path | Mode | Contract |
| --- | --- | --- | --- |
| `docs/ARCHITECTURE.md` | `docs/ARCHITECTURE.md` | copy/refactor | Keep the system contract visible. |
| `docs/PROJECT_STATE.md` | `docs/PROJECT_STATE.md` | copy/refactor | Keep current state and progress visible. |
| `docs/ONBOARDING.md` | `docs/ONBOARDING.md` | copy/refactor | Preserve onboarding steps. |
| `docs/ROADMAP.md` | `docs/ROADMAP.md` | copy/refactor | Preserve product direction. |
| `docs/MODEL_ROUTING.md` | `docs/MODEL_ROUTING.md` | copy | Preserve model policy. |
| `docs/CONTABILIUM_API.md` | `docs/CONTABILIUM_API.md` | copy | Preserve external API contract. |
| `docs/modules/*.md` | `docs/modules/*.md` | copy/refactor | Preserve module boundaries. |
| `docs/products/*.md` | `docs/products/*.md` | copy/refactor | Preserve product surface and segment contract. |
| `docs/reconstruction/*` | `docs/reconstruction/*` | copy | Preserve migration bridge. |
| `grafana/**` | `grafana/**` | copy | Preserve monitoring assets. |

## Build and deployment scaffolding

| Legacy path | Suggested new path | Mode | Contract |
| --- | --- | --- | --- |
| `backend/requirements.txt` | `backend/requirements.txt` | copy | Preserve backend dependency set. |
| `frontend/package.json` | `frontend/package.json` | copy | Preserve frontend scripts and dependencies. |
| `frontend/package-lock.json` | `frontend/package-lock.json` | copy | Preserve locked dependency graph. |
| `frontend/next.config.ts` | `frontend/next.config.ts` | copy/refactor | Preserve Next.js runtime config. |
| `frontend/tsconfig.json` | `frontend/tsconfig.json` | copy | Preserve TypeScript contract. |
| `frontend/Dockerfile` | `frontend/Dockerfile` | copy/refactor | Preserve container build behavior. |
| `frontend/docker-compose.yml` | `frontend/docker-compose.yml` | copy/refactor | Preserve local compose behavior. |
| `frontend/deploy.sh` | `frontend/deploy.sh` | copy | Preserve deployment helper. |
| `frontend/src/app/layout.tsx` | `frontend/src/app/layout.tsx` | copy/refactor | Preserve root shell and metadata. |
| `frontend/src/app/globals.css` | `frontend/src/app/globals.css` | copy/refactor | Preserve tokens and global style contract. |
| `frontend/src/app/login/page.tsx` | `frontend/src/app/login/page.tsx` | copy/refactor | Preserve login entry surface. |
| `frontend/src/components/ui/*` | `frontend/src/components/ui/*` | copy | Preserve reusable UI primitives. |
| `frontend/src/lib/chat/*` | `frontend/src/lib/chat/*` | copy/refactor | Preserve chat tool and type contracts. |
| `frontend/src/lib/pipeline/types.ts` | `frontend/src/lib/pipeline/types.ts` | copy | Preserve pipeline data contract. |

## Migration rules

- `copy`: keep behavior and shape almost as-is.
- `refactor`: keep the contract, improve structure.
- `split`: break one legacy file into a cleaner set of files.
- `defer`: not required for the first reconstruction pass.

## Priority rules

1. Backend and DB contracts first.
2. Operations and onboarding second.
3. Frontend surfaces after backend parity exists.
4. Docs stay synchronized with the code they describe.
