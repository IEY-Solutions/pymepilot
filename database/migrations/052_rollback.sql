-- Rollback 052: Revertir fix de seguridad branding
-- ============================================================
-- ATENCION: Este rollback restaura el estado INSEGURO de 046.
-- Solo usar si la migracion 052 causa problemas y se necesita
-- revertir temporalmente. Re-aplicar 052 lo antes posible.
-- ============================================================

BEGIN;

-- 1. Restaurar VIEW sin branding_config (estado post-031)
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

GRANT SELECT ON tenant_info_secure TO authenticated;

-- 2. Eliminar funcion de branding
DROP FUNCTION IF EXISTS update_tenant_branding(JSONB);

-- 3. Restaurar policies y permisos de 046
CREATE POLICY tenant_select ON public.tenants
FOR SELECT USING (
    coalesce(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
        current_setting('app.tenant_id', true)
    ) IS NULL
    OR
    id::text = coalesce(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
        current_setting('app.tenant_id', true)
    )
);

CREATE POLICY tenant_update ON public.tenants
FOR UPDATE USING (
    id::text = coalesce(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
        current_setting('app.tenant_id', true)
    )
);

GRANT SELECT, UPDATE ON public.tenants TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
