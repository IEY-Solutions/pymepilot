# Backend packet

## Why this packet exists

This is the highest-value slice of the legacy repo. It contains the logic that
would be most expensive to rediscover from scratch: orchestration, sync,
tenant-aware DB access, model routing, onboarding and prompt execution.

## Read order inside the backend

1. `backend/main.py`
2. `backend/engine/core/env_guard.py`
3. `backend/engine/core/logger.py`
4. `backend/config/settings.py`
5. `backend/engine/claude/client.py`
6. `backend/engine/model_context.py`
7. `backend/engine/model_router.py`
8. `backend/engine/db/connection.py`
9. `backend/engine/db/queries.py`
10. `backend/engine/connectors/base.py`
11. `backend/engine/connectors/sync.py`
12. `backend/engine/connectors/contabilium.py`
13. `backend/engine/connectors/excel.py`
14. `backend/engine/connectors/smart.py`
15. `backend/engine/connectors/crypto.py`
16. `backend/config/prompts/asesor_chat.txt`
17. `backend/config/prompts/smart_upload.txt`
18. `backend/config/prompts/seguimiento/reposicion.txt`
19. `backend/config/prompts/seguimiento/activacion.txt`
20. `backend/config/prompts/seguimiento/recuperacion.txt`
21. `backend/config/prompts/seguimiento/cross_sell.txt`
22. `backend/engine/seguimiento/__init__.py`
23. `backend/engine/seguimiento/base.py`
24. `backend/engine/seguimiento/reposicion.py`
25. `backend/engine/seguimiento/activacion.py`
26. `backend/engine/seguimiento/recuperacion.py`
27. `backend/engine/seguimiento/cross_sell.py`
28. `backend/engine/push/sender.py`
29. `backend/scripts/create_tenant.py`
30. `backend/scripts/sync_erp.py`
31. `backend/scripts/run_vertical.py`
32. `backend/scripts/run_attribution.py`
33. `backend/scripts/route_model.py`
34. `backend/scripts/process_uploads.py`
35. `backend/tests/*`

## Contracts that must survive the migration

- Daily pipeline order:
  1. sync
  2. attribution
  3. vertical generation
  4. push / delivery
- Tenant isolation:
  - every DB call must respect tenant context
  - every onboarding flow must leave the tenant visible only to itself
- Model routing:
  - default model selection must be centralized
  - routing context must be logged
  - escalation rules must be consistent
- Sync semantics:
  - ERP sources are read-only
  - sync must be repeatable
  - retries must not duplicate state
- Prompt execution:
  - prompts are loaded by module
  - dry-run must preserve flow without LLM spend

## What to port vs what to reshape

### Port almost as-is

- `backend/engine/db/connection.py`
- `backend/engine/db/queries.py`
- `backend/engine/core/env_guard.py`
- `backend/engine/core/logger.py`
- `backend/engine/connectors/base.py`
- `backend/engine/connectors/sync.py`
- `backend/engine/connectors/crypto.py`
- `backend/scripts/route_model.py`

### Port with structural cleanup

- `backend/main.py`
- `backend/scripts/create_tenant.py`
- `backend/engine/connectors/contabilium.py`
- `backend/engine/connectors/excel.py`
- `backend/engine/connectors/smart.py`
- `backend/engine/seguimiento/*.py`
- `backend/engine/push/sender.py`

### Keep as regression reference

- `backend/tests/test_main_orchestrator.py`
- `backend/tests/test_model_router.py`
- `backend/tests/test_model_context.py`
- `backend/tests/test_db_queries.py`
- `backend/tests/test_create_tenant_auth_fallback.py`
- `backend/tests/test_seguimiento_prompts.py`

## New repo placement recommendation

- `backend/app/` for top-level orchestration and app wiring.
- `backend/core/` for runtime, DB and model-routing primitives.
- `backend/integrations/` for external systems.
- `backend/modules/` for product logic like seguimiento.
- `scripts/` for user-facing operational CLIs.

This layout keeps the backend readable while preserving the exact legacy
contracts that already proved correct.
