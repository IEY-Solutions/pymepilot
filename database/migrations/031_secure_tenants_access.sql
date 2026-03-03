-- =============================================================================
-- MIGRACION 031: Restringir acceso a tenants + funciones admin SECURITY DEFINER
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- 1. REVOKE SELECT en tenants para authenticated (C-01 FIX)
-- 2. Crear VIEW tenant_info_secure con columnas seguras (C-01 FIX)
-- 3. Crear funciones SECURITY DEFINER para operaciones admin (H-01/H-02 FIX)
--
-- POR QUE:
-- C-01: La tabla tenants no tiene RLS. Con GRANT SELECT a authenticated,
--       cualquier usuario del dashboard puede leer erp_config de TODOS los
--       tenants (incluyendo client_id en plaintext y client_secret_encrypted).
--       Esto es un leak cross-tenant CRITICAL.
--
-- H-01: Migration 023 revoco INSERT/UPDATE en tenants para pymepilot_app
--       (correcto por minimo privilegio). Pero create_tenant.py necesita
--       INSERT. SECURITY DEFINER acota el privilegio a operaciones validadas.
--
-- H-02: user_profiles tiene RLS + FORCE RLS. Sin tenant context,
--       pymepilot_app no puede INSERT. SECURITY DEFINER bypasea RLS
--       solo para la operacion especifica de crear perfiles admin.
--
-- CONCEPTO - SECURITY DEFINER:
-- Una funcion SECURITY DEFINER ejecuta con los permisos de QUIEN LA CREO
-- (postgres, superuser), no de quien la llama (pymepilot_app). Es como
-- un empleado de banco que puede abrir la boveda con su llave solo para
-- hacer UNA operacion especifica, sin darle la llave al cliente.
--
-- CONCEPTO - VIEW con filtro:
-- Una VIEW es como una ventana que solo muestra parte de una tabla.
-- tenant_info_secure muestra solo columnas seguras (sin erp_config)
-- y solo la fila del tenant del usuario actual.
-- =============================================================================

BEGIN;

-- =============================================
-- 1. REVOCAR SELECT en tenants para authenticated (C-01 FIX)
-- =============================================
-- Antes: cualquier usuario del dashboard podia leer TODA la tabla tenants,
-- incluyendo erp_config con credenciales.
-- Despues: authenticated solo puede leer la VIEW segura.
REVOKE SELECT ON tenants FROM authenticated;

-- =============================================
-- 2. CREAR VIEW tenant_info_secure (C-01 FIX)
-- =============================================
-- Solo columnas seguras, filtrada por tenant del usuario actual.
-- has_erp_credentials es un boolean derivado (no expone valores).
-- La VIEW corre como postgres (owner), que SI tiene SELECT en tenants.
-- El WHERE filtra por get_current_tenant_id() del JWT.
DROP VIEW IF EXISTS tenant_info_secure;
CREATE VIEW tenant_info_secure AS
SELECT
    id,
    name,
    slug,
    erp_type,
    active,
    active_verticals,
    (erp_config IS NOT NULL
     AND erp_config->>'client_id' IS NOT NULL
     AND erp_config->>'client_id' != '') AS has_erp_credentials
FROM tenants
WHERE id = get_current_tenant_id();

-- Solo authenticated puede leer la VIEW (dashboard).
-- pymepilot_app no la necesita (accede directo a tenants via SELECT).
GRANT SELECT ON tenant_info_secure TO authenticated;

-- =============================================
-- 3. FUNCIONES SECURITY DEFINER (H-01/H-02 FIX)
-- =============================================
-- Cada funcion es una operacion admin acotada.
-- pymepilot_app puede llamarlas pero NO tiene acceso directo a INSERT/UPDATE.

-- 3a. admin_create_tenant: INSERT en tenants (H-01)
CREATE OR REPLACE FUNCTION admin_create_tenant(
    p_name TEXT,
    p_slug TEXT,
    p_erp_type TEXT,
    p_active_verticals JSONB
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    INSERT INTO tenants (name, slug, erp_type, active_verticals, active)
    VALUES (p_name, p_slug, p_erp_type, p_active_verticals, true)
    RETURNING id INTO v_tenant_id;

    RETURN v_tenant_id;
END;
$$;

-- Solo pymepilot_app puede llamar esta funcion (no authenticated)
REVOKE ALL ON FUNCTION admin_create_tenant(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_tenant(TEXT, TEXT, TEXT, JSONB) TO pymepilot_app;

-- 3b. admin_upsert_user_profile: INSERT en user_profiles bypaseando RLS (H-02)
CREATE OR REPLACE FUNCTION admin_upsert_user_profile(
    p_user_id UUID,
    p_tenant_id UUID,
    p_full_name TEXT,
    p_role TEXT DEFAULT 'admin'
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO user_profiles (id, tenant_id, full_name, role)
    VALUES (p_user_id, p_tenant_id, p_full_name, p_role)
    ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION admin_upsert_user_profile(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_upsert_user_profile(UUID, UUID, TEXT, TEXT) TO pymepilot_app;

-- 3c. admin_save_erp_config: UPDATE erp_config en tenants (para crypto.py)
-- Usado por save_tenant_credentials() y rotate_encryption_key()
CREATE OR REPLACE FUNCTION admin_save_erp_config(
    p_slug TEXT,
    p_config JSONB
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE tenants SET erp_config = p_config WHERE slug = p_slug;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant con slug ''%'' no encontrado', p_slug;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION admin_save_erp_config(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_save_erp_config(TEXT, JSONB) TO pymepilot_app;

-- =============================================
-- 4. NOTIFICAR PostgREST para recargar schema
-- =============================================
-- PostgREST cachea el schema. Sin esto, no veria la nueva VIEW
-- ni dejaria de ver la tabla tenants.
NOTIFY pgrst, 'reload schema';

COMMIT;
