-- ============================================================
-- Migracion 053: Fixes de seguridad en funciones y RPCs
-- ============================================================
-- QUE HACE:
-- 1. Fix get_tenant_info_secure(): agregar SET search_path + REVOKE FROM PUBLIC
--    + incluir branding_config en el retorno (consistente con VIEW de 052)
-- 2. Fix sync_predictions_to_pipeline(): REVOKE FROM PUBLIC
-- 3. Fix get_total_sales(): agregar LEAST/GREATEST en p_months
--
-- POR QUE:
-- H-01: SECURITY DEFINER sin SET search_path permite search_path hijack
-- H-02: EXECUTE otorgado a PUBLIC por default de PostgreSQL (deberia ser solo authenticated)
-- H-03: p_months sin limite permite DoS via scan historico completo
--
-- CONCEPTO - search_path hijack:
-- Si una funcion SECURITY DEFINER no fija su search_path, un atacante
-- podria crear una funcion con el mismo nombre en otro schema y hacer
-- que la funcion privilegiada la llame en vez de la real.
-- SET search_path = public fuerza que siempre use el schema correcto.
-- ============================================================

BEGIN;

-- =============================================
-- 1. FIX get_tenant_info_secure() (H-01)
-- =============================================
-- Agrega SET search_path, REVOKE FROM PUBLIC, y branding_config
-- DROP necesario porque el tipo de retorno cambia (se agrega branding_config)
DROP FUNCTION IF EXISTS public.get_tenant_info_secure();
CREATE FUNCTION public.get_tenant_info_secure()
RETURNS TABLE (
    id uuid,
    name text,
    slug text,
    erp_type text,
    active boolean,
    active_verticals jsonb,
    branding_config jsonb,
    has_erp_credentials boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT
        t.id,
        t.name,
        t.slug,
        t.erp_type,
        t.active,
        t.active_verticals,
        t.branding_config,
        (
            t.erp_config IS NOT NULL
            AND (t.erp_config ->> 'client_id') IS NOT NULL
            AND (t.erp_config ->> 'client_id') <> ''
        ) AS has_erp_credentials
    FROM public.tenants t
    WHERE t.id = public.get_current_tenant_id();
$$;

REVOKE ALL ON FUNCTION public.get_tenant_info_secure() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_info_secure() TO authenticated;

-- =============================================
-- 2. FIX sync_predictions_to_pipeline() (H-02)
-- =============================================
-- Solo REVOKE FROM PUBLIC (la funcion ya tiene SET search_path desde 047)
REVOKE ALL ON FUNCTION public.sync_predictions_to_pipeline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_predictions_to_pipeline() TO authenticated;

-- =============================================
-- 3. FIX get_total_sales() (H-03)
-- =============================================
-- Agregar LEAST/GREATEST como las 6 RPCs de KPI (migration 033)
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
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_total_sales(int) TO authenticated;

-- =============================================
-- 4. NOTIFICAR PostgREST
-- =============================================
NOTIFY pgrst, 'reload schema';

COMMIT;
