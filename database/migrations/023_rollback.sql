-- =============================================================================
-- ROLLBACK 023: Revertir security hardening
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- NOTA: Restaura los permisos al estado pre-023 (menos seguro)
-- =============================================================================

BEGIN;

-- 1. Restaurar DEFAULT PRIVILEGES (como estaban en 012)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO pymepilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO pymepilot_app;

-- 2. Restaurar UPDATE completo en predictions
REVOKE UPDATE (status, contacted_at, updated_at) ON predictions FROM authenticated;
GRANT UPDATE ON predictions TO authenticated;

-- 3. Restaurar INSERT/UPDATE en tenants
GRANT INSERT, UPDATE ON tenants TO pymepilot_app;

COMMIT;
