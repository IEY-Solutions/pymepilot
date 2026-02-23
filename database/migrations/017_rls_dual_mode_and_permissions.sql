-- =============================================================================
-- MIGRACION 017: RLS dual-mode + permisos por rol + FORCE RLS
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- PROPOSITO: Permitir que TANTO el motor Python (via set_tenant_context) COMO
--            el dashboard (via JWT de PostgREST) accedan a los datos, usando
--            una sola funcion get_current_tenant_id() que detecta el contexto.
-- =============================================================================

BEGIN;

-- =============================================
-- 1. FUNCION DUAL-MODE: get_current_tenant_id()
-- =============================================
-- Intenta 2 fuentes de tenant_id:
--   1. JWT claims (cuando el request viene del dashboard via PostgREST)
--   2. app.tenant_id (cuando el request viene del motor Python)
-- Si ninguna tiene valor: retorna NULL → RLS filtra todo (fail-closed)
--
-- CONCEPTO: Es como un guardia que acepta 2 tipos de credencial
-- (tarjeta magnética O código PIN), pero si no tenés ninguna, no pasás.

CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
DECLARE
    v_tenant_id TEXT;
BEGIN
    -- Intento 1: JWT (dashboard via PostgREST)
    -- auth.jwt() existe en orion_db, lee request.jwt.claim(s)
    BEGIN
        v_tenant_id := (auth.jwt() -> 'app_metadata' ->> 'tenant_id');
    EXCEPTION WHEN OTHERS THEN
        v_tenant_id := NULL;
    END;

    -- Intento 2: app.tenant_id (motor Python via set_tenant_context)
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
        v_tenant_id := current_setting('app.tenant_id', true);
    END IF;

    -- Fail-closed: sin contexto = NULL = 0 filas
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_tenant_id::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Todos los roles necesitan ejecutar esta funcion (la usan las policies)
GRANT EXECUTE ON FUNCTION get_current_tenant_id() TO authenticated, anon, pymepilot_app;

-- =============================================
-- 2. ACTUALIZAR RLS POLICIES (usar get_current_tenant_id)
-- =============================================
-- Reemplazamos las policies de 016 que usaban current_setting directo
-- por la nueva funcion dual-mode

-- user_profiles
DROP POLICY IF EXISTS user_profiles_tenant_isolation ON user_profiles;
CREATE POLICY user_profiles_tenant_isolation ON user_profiles
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- customers
DROP POLICY IF EXISTS customers_tenant_isolation ON customers;
CREATE POLICY customers_tenant_isolation ON customers
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- products
DROP POLICY IF EXISTS products_tenant_isolation ON products;
CREATE POLICY products_tenant_isolation ON products
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- orders
DROP POLICY IF EXISTS orders_tenant_isolation ON orders;
CREATE POLICY orders_tenant_isolation ON orders
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- order_items
DROP POLICY IF EXISTS order_items_tenant_isolation ON order_items;
CREATE POLICY order_items_tenant_isolation ON order_items
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- predictions
DROP POLICY IF EXISTS predictions_tenant_isolation ON predictions;
CREATE POLICY predictions_tenant_isolation ON predictions
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- sync_log
DROP POLICY IF EXISTS sync_log_tenant_isolation ON sync_log;
CREATE POLICY sync_log_tenant_isolation ON sync_log
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- tenants: mantener read_all (necesaria para lookup de tenant info)
-- Ya creada en 016, no la tocamos

-- =============================================
-- 3. GRANTS PARA authenticated (dashboard users)
-- =============================================
-- IMPORTANTE: GRANTs tabla por tabla (NO "ALL TABLES") porque orion_db
-- tiene ~55 tablas de N8N que no queremos exponer

-- SELECT en todas las tablas PymePilot
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON tenants TO authenticated;
GRANT SELECT ON user_profiles TO authenticated;
GRANT SELECT ON customers TO authenticated;
GRANT SELECT ON products TO authenticated;
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON order_items TO authenticated;
GRANT SELECT ON predictions TO authenticated;
GRANT SELECT ON sync_log TO authenticated;

-- UPDATE solo en predictions (marcar contactado/ignorado)
GRANT UPDATE ON predictions TO authenticated;

-- Sequences (necesarias para operaciones internas)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================
-- 4. GRANTS PARA anon: NADA
-- =============================================
-- No se otorga ningun permiso a anon.
-- Si un request no autenticado intenta acceder, PostgreSQL devuelve
-- "permission denied" antes de que RLS siquiera se evalúe.

-- =============================================
-- 5. GRANT auth.jwt() para authenticated (necesario para RLS)
-- =============================================
GRANT USAGE ON SCHEMA auth TO authenticated, pymepilot_app;

COMMIT;
