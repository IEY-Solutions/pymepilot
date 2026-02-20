-- Rollback 012: Revert app user, FORCE RLS, and sku UNIQUE
-- Fecha: 2026-02-20
--
-- IMPORTANTE: Si la app ya usa pymepilot_app, cambiar DATABASE_USER
-- de vuelta a 'postgres' en .env ANTES de ejecutar este rollback.

-- 1. Restaurar UNIQUE constraint en sku
ALTER TABLE products ADD CONSTRAINT unique_sku_per_tenant UNIQUE (tenant_id, sku);

-- 2. Quitar FORCE ROW LEVEL SECURITY
ALTER TABLE customers NO FORCE ROW LEVEL SECURITY;
ALTER TABLE products NO FORCE ROW LEVEL SECURITY;
ALTER TABLE orders NO FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE predictions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE sync_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE user_profiles NO FORCE ROW LEVEL SECURITY;

-- 3. Revocar permisos y eliminar usuario
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE ON TABLES FROM pymepilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE ON SEQUENCES FROM pymepilot_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM pymepilot_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM pymepilot_app;
REVOKE USAGE ON SCHEMA public FROM pymepilot_app;
DROP USER IF EXISTS pymepilot_app;
