-- Rollback 038: Restaurar tenant_info_secure en auth

-- Recrear en auth
CREATE OR REPLACE VIEW auth.tenant_info_secure AS
SELECT
    t.id,
    t.name,
    t.slug,
    t.erp_type,
    t.active,
    t.active_verticals,
    (
        t.erp_config IS NOT NULL
        AND (t.erp_config ->> 'client_id') IS NOT NULL
        AND (t.erp_config ->> 'client_id') <> ''
    ) AS has_erp_credentials
FROM tenants t
WHERE t.id = get_current_tenant_id();

-- Eliminar de public
DROP VIEW IF EXISTS public.tenant_info_secure;

NOTIFY pgrst, 'reload schema';
