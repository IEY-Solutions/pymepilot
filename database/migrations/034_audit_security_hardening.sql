-- =============================================================================
-- MIGRACION 034: Hardening de seguridad (auditoria Fase 9 Ronda 1)
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- 1. Fix M-01: SET search_path + REVOKE/GRANT en refresh_materialized_views()
-- 2. Fix M-02: Regex mejorado en get_monthly_value() (rechaza "." suelto)
-- 3. Fix M-03: GREATEST(param, 1) como piso en las 6 RPCs (rechaza negativos)
--
-- POR QUE:
-- 1. SECURITY DEFINER sin SET search_path es un vector teorico de hijack.
--    Al fijar search_path=public, la funcion ignora cualquier manipulacion
--    del search_path del caller. Patron consistente con migration 031.
-- 2. El regex ^\d+\.?\d*$ aceptaba "." (punto solo) que haria fallar el
--    cast a numeric. El nuevo regex ^\d+(\.\d+)?$ exige digitos a ambos
--    lados del punto.
-- 3. LEAST(p_months, 24) pone techo pero no piso: un negativo bypasea el
--    limite. GREATEST(p_months, 1) asegura minimo 1 mes.
--
-- CONCEPTO — SET search_path en SECURITY DEFINER:
-- Cuando una funcion corre como superuser (SECURITY DEFINER), hereda el
-- search_path del caller por defecto. Si un atacante manipula su
-- search_path para poner un schema malicioso primero, la funcion
-- resolveria nombres de objeto en ese schema. SET search_path = public
-- fuerza a que siempre busque en public, independientemente del caller.
-- =============================================================================

BEGIN;

-- =============================================
-- 1. FIX M-01: SET search_path en refresh_materialized_views
-- =============================================
-- Re-crea la funcion con SET search_path = public
-- Luego revoca acceso de PUBLIC y otorga solo a pymepilot_app

CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    -- co_purchases: intenta CONCURRENTLY primero (no bloquea lecturas)
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.co_purchases;
    EXCEPTION
        WHEN feature_not_supported THEN
            -- Primera vez: MV sin datos, CONCURRENTLY no es posible
            RAISE WARNING 'co_purchases: primera vez o sin datos, refresh completo';
            REFRESH MATERIALIZED VIEW public.co_purchases;
        WHEN lock_not_available THEN
            RAISE WARNING 'co_purchases: bloqueada por otra sesion, saltando';
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Error inesperado refrescando co_purchases: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;

    -- client_rankings: misma logica
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_rankings;
    EXCEPTION
        WHEN feature_not_supported THEN
            RAISE WARNING 'client_rankings: primera vez o sin datos, refresh completo';
            REFRESH MATERIALIZED VIEW public.client_rankings;
        WHEN lock_not_available THEN
            RAISE WARNING 'client_rankings: bloqueada por otra sesion, saltando';
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Error inesperado refrescando client_rankings: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.refresh_materialized_views() IS
    'Refresca co_purchases y client_rankings. SECURITY DEFINER con search_path fijo. Solo pymepilot_app puede ejecutarla.';

-- Revocar acceso de PUBLIC (por defecto PostgreSQL otorga EXECUTE a PUBLIC)
REVOKE ALL ON FUNCTION public.refresh_materialized_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_materialized_views() TO pymepilot_app;

-- =============================================
-- 2. FIX M-02: Regex mejorado en get_monthly_value
-- + FIX M-03: GREATEST(p_months, 1) como piso
-- =============================================
-- Regex: ^\d+\.?\d*$  -->  ^\d+(\.\d+)?$
-- LEAST(p_months, 24) --> LEAST(GREATEST(p_months, 1), 24)

CREATE OR REPLACE FUNCTION public.get_monthly_value(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    attributed_value numeric,
    predictions_converted int
) AS $$
    SELECT
        date_trunc('month', p.prediction_date)::date AS month,
        COALESCE(
            SUM(
                CASE
                    WHEN p.metadata->>'attribution_amount' ~ '^\d+(\.\d+)?$'
                    THEN (p.metadata->>'attribution_amount')::numeric
                    ELSE 0
                END
            ),
            0
        ) AS attributed_value,
        COUNT(*)::int AS predictions_converted
    FROM predictions p
    WHERE p.status = 'completed'
      AND p.metadata ? 'attribution_amount'
      AND p.prediction_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', p.prediction_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_monthly_value(int)
    TO authenticated;

-- =============================================
-- 3. FIX M-03: GREATEST piso en las 5 RPCs restantes
-- =============================================

-- 3a. get_monthly_revenue_split
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_split(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    total_revenue numeric,
    recurring_revenue numeric,
    new_revenue numeric,
    recurring_pct numeric
) AS $$
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        SUM(o.total_amount) AS total_revenue,
        SUM(CASE WHEN c.total_purchases_count >= 2
            THEN o.total_amount ELSE 0 END) AS recurring_revenue,
        SUM(CASE WHEN c.total_purchases_count < 2
            THEN o.total_amount ELSE 0 END) AS new_revenue,
        ROUND(
            SUM(CASE WHEN c.total_purchases_count >= 2
                THEN o.total_amount ELSE 0 END)
            / NULLIF(SUM(o.total_amount), 0) * 100,
            1
        ) AS recurring_pct
    FROM orders o
    JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
    WHERE o.status = 'completed'
      AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_monthly_revenue_split(int)
    TO authenticated;

-- 3b. get_monthly_churn
CREATE OR REPLACE FUNCTION public.get_monthly_churn(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    active_prev int,
    churned int,
    churn_rate numeric
) AS $$
    WITH monthly_active AS (
        SELECT DISTINCT
            date_trunc('month', o.order_date)::date AS month,
            o.customer_id
        FROM orders o
        WHERE o.status = 'completed'
    ),
    month_pairs AS (
        SELECT
            prev.month + interval '1 month' AS curr_month,
            prev.customer_id,
            CASE WHEN curr.customer_id IS NULL THEN 1 ELSE 0 END AS is_churned
        FROM monthly_active prev
        LEFT JOIN monthly_active curr
            ON curr.customer_id = prev.customer_id
            AND curr.month = prev.month + interval '1 month'
        WHERE prev.month >= date_trunc('month', CURRENT_DATE)::date
              - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
          AND prev.month < date_trunc('month', CURRENT_DATE)::date
    )
    SELECT
        curr_month::date AS month,
        COUNT(*)::int AS active_prev,
        SUM(is_churned)::int AS churned,
        ROUND(
            SUM(is_churned)::numeric
            / NULLIF(COUNT(*), 0) * 100,
            1
        ) AS churn_rate
    FROM month_pairs
    GROUP BY curr_month
    ORDER BY curr_month;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_monthly_churn(int)
    TO authenticated;

-- 3c. get_monthly_ticket
CREATE OR REPLACE FUNCTION public.get_monthly_ticket(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    avg_ticket numeric,
    avg_ticket_recurring numeric,
    avg_ticket_new numeric
) AS $$
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        ROUND(AVG(o.total_amount), 0) AS avg_ticket,
        ROUND(AVG(CASE WHEN c.total_purchases_count >= 2
            THEN o.total_amount END), 0) AS avg_ticket_recurring,
        ROUND(AVG(CASE WHEN c.total_purchases_count < 2
            THEN o.total_amount END), 0) AS avg_ticket_new
    FROM orders o
    JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
    WHERE o.status = 'completed'
      AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_monthly_ticket(int)
    TO authenticated;

-- 3d. get_client_trends
CREATE OR REPLACE FUNCTION public.get_client_trends(
    p_months_window int DEFAULT 3
)
RETURNS TABLE (
    customer_id uuid,
    recent_revenue numeric,
    previous_revenue numeric,
    trend text
) AS $$
    WITH recent AS (
        SELECT
            o.customer_id,
            COALESCE(SUM(o.total_amount), 0) AS revenue
        FROM orders o
        WHERE o.status = 'completed'
          AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
              - (LEAST(GREATEST(p_months_window, 1), 24) || ' months')::interval
        GROUP BY o.customer_id
    ),
    previous AS (
        SELECT
            o.customer_id,
            COALESCE(SUM(o.total_amount), 0) AS revenue
        FROM orders o
        WHERE o.status = 'completed'
          AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
              - (2 * LEAST(GREATEST(p_months_window, 1), 24) || ' months')::interval
          AND o.order_date < date_trunc('month', CURRENT_DATE)::date
              - (LEAST(GREATEST(p_months_window, 1), 24) || ' months')::interval
        GROUP BY o.customer_id
    )
    SELECT
        COALESCE(r.customer_id, p.customer_id) AS customer_id,
        COALESCE(r.revenue, 0) AS recent_revenue,
        COALESCE(p.revenue, 0) AS previous_revenue,
        CASE
            WHEN COALESCE(p.revenue, 0) = 0 AND COALESCE(r.revenue, 0) > 0 THEN 'up'
            WHEN COALESCE(r.revenue, 0) = 0 AND COALESCE(p.revenue, 0) > 0 THEN 'down'
            WHEN COALESCE(p.revenue, 0) = 0 AND COALESCE(r.revenue, 0) = 0 THEN 'stable'
            WHEN (r.revenue - p.revenue) / p.revenue > 0.10 THEN 'up'
            WHEN (p.revenue - r.revenue) / p.revenue > 0.10 THEN 'down'
            ELSE 'stable'
        END AS trend
    FROM recent r
    FULL OUTER JOIN previous p ON p.customer_id = r.customer_id;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_client_trends(int)
    TO authenticated;

-- 3e. get_client_monthly_revenue
CREATE OR REPLACE FUNCTION public.get_client_monthly_revenue(
    p_customer_id uuid,
    p_months int DEFAULT 4
)
RETURNS TABLE (
    month date,
    revenue numeric
) AS $$
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        SUM(o.total_amount) AS revenue
    FROM orders o
    WHERE o.customer_id = p_customer_id
      AND o.status = 'completed'
      AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_client_monthly_revenue(uuid, int)
    TO authenticated;

-- =============================================
-- 4. NOTIFICAR PostgREST para recargar schema
-- =============================================
NOTIFY pgrst, 'reload schema';

COMMIT;
