-- Rollback 053: Revertir fixes de seguridad en funciones
-- ============================================================

BEGIN;

-- 1. Restaurar get_tenant_info_secure() sin search_path ni branding_config (estado 038)
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

-- 2. Restaurar get_total_sales() sin LEAST/GREATEST (estado 035)
CREATE OR REPLACE FUNCTION public.get_total_sales(
    p_months int DEFAULT 2
)
RETURNS TABLE (
    month date,
    total_orders bigint,
    total_revenue numeric
) AS $$
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        COUNT(*) AS total_orders,
        COALESCE(SUM(o.total_amount), 0) AS total_revenue
    FROM orders o
    WHERE o.status = 'completed'
      AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
          - (p_months || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_total_sales(int) TO authenticated;

-- 3. sync_predictions_to_pipeline: no hay rollback necesario
-- (REVOKE FROM PUBLIC no se puede "des-revocar" a un estado previo con sentido)

NOTIFY pgrst, 'reload schema';

COMMIT;
