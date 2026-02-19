-- Migration 010: Create helper functions and triggers
-- Fecha: 2026-02-19
-- Descripcion: Funciones auxiliares reutilizables por todo el sistema
--
-- QUE SON LOS TRIGGERS:
-- Un trigger es una "alarma" en la base de datos. Cuando pasa algo
-- (insertar, actualizar, eliminar un registro), el trigger ejecuta
-- una funcion automaticamente.
--
-- Ejemplo: Cada vez que actualizamos un cliente, el trigger
-- automaticamente pone la fecha actual en "updated_at".
-- Asi no tenemos que acordarnos de hacerlo manualmente cada vez.

-- ============================================================
-- Funcion: trigger_set_updated_at()
-- Actualiza automaticamente la columna updated_at cuando se modifica un registro
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_set_updated_at() IS 'Trigger function que actualiza updated_at automaticamente en cada UPDATE';

-- Aplicar trigger a TODAS las tablas que tienen updated_at
CREATE TRIGGER set_updated_at_tenants
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_user_profiles
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_customers
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_products
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_predictions
    BEFORE UPDATE ON predictions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- Funcion: set_tenant_context(tenant_id)
-- Configura el contexto de tenant para la sesion actual de PostgreSQL
-- TODAS las queries con RLS van a filtrar por este tenant automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, false);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_tenant_context(UUID) IS 'Configura el tenant activo para la sesion. Las RLS policies filtran segun este valor.';

-- ============================================================
-- Funcion: get_tenant_id_by_slug(slug)
-- Obtiene el UUID de un tenant por su slug (util para scripts)
-- ============================================================
CREATE OR REPLACE FUNCTION get_tenant_id_by_slug(p_slug TEXT)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_slug AND active = true;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant con slug "%" no encontrado o inactivo', p_slug;
    END IF;
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tenant_id_by_slug(TEXT) IS 'Resuelve slug -> UUID. Lanza error si el tenant no existe o esta inactivo.';
