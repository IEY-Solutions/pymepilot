-- =============================================================================
-- ROLLBACK 017: Revertir RLS dual-mode y permisos
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Restaura policies a formato 016 (current_setting directo)
-- =============================================================================

BEGIN;

-- Revocar permisos de authenticated
REVOKE ALL ON tenants, user_profiles, customers, products, orders,
    order_items, predictions, sync_log FROM authenticated;
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE USAGE ON SCHEMA public FROM authenticated;
REVOKE USAGE ON SCHEMA auth FROM authenticated, pymepilot_app;

-- Restaurar policies a formato 016
DROP POLICY IF EXISTS user_profiles_tenant_isolation ON user_profiles;
CREATE POLICY user_profiles_tenant_isolation ON user_profiles
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS customers_tenant_isolation ON customers;
CREATE POLICY customers_tenant_isolation ON customers
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS products_tenant_isolation ON products;
CREATE POLICY products_tenant_isolation ON products
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS orders_tenant_isolation ON orders;
CREATE POLICY orders_tenant_isolation ON orders
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS order_items_tenant_isolation ON order_items;
CREATE POLICY order_items_tenant_isolation ON order_items
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS predictions_tenant_isolation ON predictions;
CREATE POLICY predictions_tenant_isolation ON predictions
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS sync_log_tenant_isolation ON sync_log;
CREATE POLICY sync_log_tenant_isolation ON sync_log
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Eliminar funcion dual-mode
DROP FUNCTION IF EXISTS get_current_tenant_id();

COMMIT;
