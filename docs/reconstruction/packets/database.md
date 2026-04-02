# Database packet

## Why this packet exists

The database is the system contract. If the DB contract changes without a plan,
the whole reconstruction becomes speculative. This packet keeps the schema,
RLS, migration groups and validation checks in one place.

## Read order

1. `database/migrations/001_010_*`
2. `database/migrations/011_017_*`
3. `database/migrations/018_024_*`
4. `database/migrations/025_031_*`
5. `database/migrations/032_040_*`
6. `database/migrations/041_057_*`
7. `database/tests/tenant_isolation_test.sql`
8. `backend/engine/db/connection.py`
9. `backend/engine/db/queries.py`

## Core contracts

- `tenants` is the source of tenant identity and active modules.
- `user_profiles` ties auth users to tenant context and role.
- `customers`, `products`, `orders`, `order_items` carry the operational data.
- `predictions` stores the outputs of the business engine.
- `sync_log` records ingestion runs and status.
- `orchestrator_runs` records daily pipeline behavior.

## Migration groupings

### Foundation

- Extensions and base schema.
- Tenant and profile creation.
- Customers, products and orders.

### Security and tenancy

- RLS force and policy hardening.
- Permission tightening.
- Auth fallback and tenant access hardening.

### Operational expansion

- Upload jobs.
- Notifications and drive integration.
- Orchestrator tables.

### Business expansion

- KPI RPCs.
- Pipeline tables.
- Achievements, streaks, product rankings and key accounts.

### Monitoring and product metadata

- Grafana-related views and metrics support.
- Branding data.
- Platform module configuration.

## What must be validated in the new repo

- A tenant cannot see another tenant's rows.
- A new admin profile is tied to the correct tenant.
- A sync run leaves a traceable log entry.
- A pipeline run leaves a reproducible execution record.
- The key business RPCs still return the expected shapes.

## What to avoid

- Rewriting policies by intuition.
- Moving SQL into scattered ad-hoc helpers.
- Removing a migration without first capturing the contract it encoded.
- Letting frontend filters stand in for DB isolation.
