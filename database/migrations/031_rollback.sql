-- =============================================================================
-- ROLLBACK 031: Restaurar acceso directo a tenants para authenticated
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- NOTA: Solo usar si la migracion 031 causa problemas.

BEGIN;

-- 1. Restaurar GRANT SELECT en tenants para authenticated
GRANT SELECT ON tenants TO authenticated;

-- 2. Eliminar VIEW
DROP VIEW IF EXISTS tenant_info_secure;

-- 3. Eliminar funciones SECURITY DEFINER
DROP FUNCTION IF EXISTS admin_create_tenant(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS admin_upsert_user_profile(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_save_erp_config(TEXT, JSONB);

-- 4. Recargar schema PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
