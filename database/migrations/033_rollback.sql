-- =============================================================================
-- ROLLBACK 033: Revertir fixes de deuda tecnica de seguridad
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- Restaura las versiones anteriores de las funciones (sin LEAST, sin regex,
-- con EXCEPTION WHEN OTHERS generico).
-- Las funciones se recrean desde las migrations originales (026, 027, 028).
-- =============================================================================

BEGIN;

-- 1. Restaurar refresh_materialized_views (version 026 original)
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.co_purchases;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.co_purchases;
    END;

    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_rankings;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.client_rankings;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Restaurar get_monthly_value (version 027 original, sin regex, sin LEAST)
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
            SUM((p.metadata->>'attribution_amount')::numeric),
            0
        ) AS attributed_value,
        COUNT(*)::int AS predictions_converted
    FROM predictions p
    WHERE p.status = 'completed'
      AND p.metadata ? 'attribution_amount'
      AND p.prediction_date >= date_trunc('month', CURRENT_DATE)::date
          - (p_months || ' months')::interval
    GROUP BY date_trunc('month', p.prediction_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

-- 3. Restaurar RPCs con p_months sin LEAST (versiones 027/028 originales)

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
          - (p_months || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

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
              - (p_months || ' months')::interval
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
          - (p_months || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

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
              - (p_months_window || ' months')::interval
        GROUP BY o.customer_id
    ),
    previous AS (
        SELECT
            o.customer_id,
            COALESCE(SUM(o.total_amount), 0) AS revenue
        FROM orders o
        WHERE o.status = 'completed'
          AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
              - (2 * p_months_window || ' months')::interval
          AND o.order_date < date_trunc('month', CURRENT_DATE)::date
              - (p_months_window || ' months')::interval
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
          - (p_months || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE;

NOTIFY pgrst, 'reload schema';

COMMIT;
