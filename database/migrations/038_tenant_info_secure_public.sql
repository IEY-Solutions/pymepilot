-- ============================================================
-- Migration 038: Mover tenant_info_secure a schema public
-- ============================================================
-- La VIEW estaba en schema auth, donde PostgREST no la expone.
-- El frontend recibe null y la card de ERP dice "No configurado"
-- aunque IEY tiene sync funcionando.

-- Usar una funcion SECURITY DEFINER porque authenticated no tiene SELECT
-- sobre tenants (revocado en migration 031 por seguridad).
-- La funcion se ejecuta con permisos del owner (postgres) y solo expone
-- columnas seguras filtradas por el tenant del JWT.

CREATE OR REPLACE FUNCTION public.get_tenant_info_secure()
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    erp_type text,
    active boolean,
    active_verticals jsonb,
    has_erp_credentials boolean
) AS $$
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
    FROM public.tenants t
    WHERE t.id = public.get_current_tenant_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_tenant_info_secure() TO authenticated;

-- La VIEW en auth ya no se usa pero no la eliminamos
-- porque puede haber otras referencias internas

-- Notificar a PostgREST
NOTIFY pgrst, 'reload schema';
