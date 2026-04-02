# Operations packet

## Why this packet exists

The repo is not finished when the code compiles. It is finished when the system
can be started, observed, onboarded and recovered without guesswork.

## Read order

1. `backend/scripts/create_tenant.py`
2. `backend/scripts/sync_erp.py`
3. `backend/scripts/run_vertical.py`
4. `backend/scripts/run_attribution.py`
5. `backend/scripts/process_uploads.py`
6. `backend/scripts/cron_wrapper.py`
7. `backend/scripts/check_data_freshness.py`
8. `backend/scripts/setup_credentials.py`
9. `backend/scripts/generate_service_role_jwt.py`
10. `docs/ONBOARDING.md`
11. `docs/PROJECT_STATE.md`
12. `docs/ARCHITECTURE.md`
13. `grafana/**`

## Operational contracts

- Onboarding must be idempotent.
- A tenant can be created, re-run and completed without duplicate state.
- The sync flow must be separable from the vertical generation flow.
- Model routing should be inspectable before executing expensive work.
- Logs must be sanitized because operational troubleshooting often touches
  secrets, tenant IDs and API payloads.

## Environment and runtime

- `.env` must be loaded explicitly.
- Runtime validation should happen before imports that depend on env vars.
- `umask` should be applied before file creation in entrypoints.
- Operational CLIs should fail fast and clearly when preconditions are missing.

## Monitoring and observability

- Grafana dashboards are part of the system contract.
- Monitoring should cover database, auth, API and app availability.
- Operational docs should describe what a healthy tenant and a healthy run
  look like.

## What to carry into the new repo

- The onboarding sequence.
- The cron behavior.
- The freshness and observability helpers.
- The failure modes already debugged in production.
- The shell/CLI entrypoints used by operators.
