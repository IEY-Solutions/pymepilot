-- ============================================================
-- Migracion 052: Corregir acceso a tenants (branding seguro)
-- ============================================================
-- QUE HACE: Revierte los permisos inseguros de migration 046
-- que re-otorgaron SELECT/UPDATE en tenants a authenticated,
-- deshaciendo el fix de seguridad de migration 031.
--
-- POR QUE: La tabla tenants contiene erp_config con credenciales
-- del ERP (client_id, client_secret_encrypted). Migration 031
-- revoco el acceso y creo una VIEW segura. Migration 046 lo
-- deshizo para que el frontend acceda a branding_config.
--
-- SOLUCION: En vez de dar acceso directo a la tabla, se actualiza
-- la VIEW tenant_info_secure para incluir branding_config, y se
-- crea una funcion SECURITY DEFINER para actualizar solo esa
-- columna. Asi branding funciona sin exponer credenciales.
--
-- CONCEPTO: Es como cambiar la ventanilla del banco para que
-- muestre un dato mas (el logo), sin darle al cliente la llave
-- de la boveda donde estan las credenciales.
-- ============================================================

BEGIN;

-- =============================================
-- 1. ELIMINAR policies inseguras de migration 046
-- =============================================
-- Estas policies permitian SELECT sin context (ve TODO) y
-- UPDATE por cualquier authenticated. Demasiado amplio.
DROP POLICY IF EXISTS tenant_select ON public.tenants;
DROP POLICY IF EXISTS tenant_update ON public.tenants;

-- =============================================
-- 2. REVOCAR permisos directos (restaurar fix 031)
-- =============================================
-- Migration 046 otorgo: GRANT SELECT, UPDATE ON tenants TO authenticated
-- Esto deshacia el REVOKE de migration 031.
REVOKE SELECT ON public.tenants FROM authenticated;
REVOKE UPDATE ON public.tenants FROM authenticated;

-- Mantener RLS habilitado (no molesta, y es defense-in-depth
-- por si alguien vuelve a dar GRANT en el futuro)

-- =============================================
-- 3. ACTUALIZAR VIEW tenant_info_secure
-- =============================================
-- Agregar branding_config a la VIEW segura.
-- erp_config sigue excluido (credenciales sensibles).
DROP VIEW IF EXISTS tenant_info_secure;
CREATE VIEW tenant_info_secure AS
SELECT
    id,
    name,
    slug,
    erp_type,
    active,
    active_verticals,
    branding_config,
    (erp_config IS NOT NULL
     AND erp_config->>'client_id' IS NOT NULL
     AND erp_config->>'client_id' != '') AS has_erp_credentials
FROM tenants
WHERE id = get_current_tenant_id();

-- Solo authenticated puede leer la VIEW
GRANT SELECT ON tenant_info_secure TO authenticated;

-- =============================================
-- 4. FUNCION para actualizar branding (SECURITY DEFINER)
-- =============================================
-- Permite al frontend actualizar SOLO branding_config,
-- sin acceso directo a la tabla tenants.
CREATE OR REPLACE FUNCTION update_tenant_branding(
    p_branding JSONB
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := get_current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant context — no se puede actualizar branding';
    END IF;

    UPDATE tenants
    SET branding_config = p_branding
    WHERE id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant no encontrado';
    END IF;
END;
$$;

-- Solo authenticated puede llamar esta funcion (frontend via PostgREST)
REVOKE ALL ON FUNCTION update_tenant_branding(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_tenant_branding(JSONB) TO authenticated;

-- =============================================
-- 5. NOTIFICAR PostgREST
-- =============================================
NOTIFY pgrst, 'reload schema';

COMMIT;
