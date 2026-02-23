-- =============================================================================
-- ROLLBACK 016: Revertir consolidacion de tablas en orion_db
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- NOTA: Esto elimina TODAS las tablas PymePilot de orion_db.
--       Los datos originales siguen en la DB postgres (no se tocaron).
-- =============================================================================

BEGIN;

-- Eliminar en orden inverso de dependencias FK
DROP TABLE IF EXISTS api_usage CASCADE;
DROP TABLE IF EXISTS sync_log CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS get_tenant_id_by_slug(TEXT);
DROP FUNCTION IF EXISTS set_tenant_context(UUID);
DROP FUNCTION IF EXISTS trigger_set_updated_at();

-- Revocar permisos de pymepilot_app
REVOKE ALL ON SCHEMA public FROM pymepilot_app;

-- NO eliminar extensiones (uuid-ossp, pgcrypto) porque podrian ser usadas
-- por otras tablas en orion_db en el futuro

COMMIT;
