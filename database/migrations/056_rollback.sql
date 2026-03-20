-- ============================================================
-- Rollback 056: Revertir fixes de seguridad post-auditoria MVP
-- ============================================================
-- QUE HACE: Revierte todos los cambios de 056_audit_security_fixes.sql
-- ORDEN: Inverso a la migracion (lo ultimo en crearse, primero en revertir)
-- ============================================================

BEGIN;

-- ============================================================
-- Revertir M-08: restaurar GRANT DELETE en contact_notes
-- ============================================================
GRANT DELETE ON public.contact_notes TO authenticated;

-- ============================================================
-- Revertir H-04: eliminar funcion batch
-- ============================================================
DROP FUNCTION IF EXISTS public.recalculate_key_account_health_scores();

-- ============================================================
-- Revertir H-03: restaurar acceso PUBLIC a las 3 RPCs de key_accounts
-- ============================================================
-- (PostgreSQL no tiene GRANT ALL TO PUBLIC para funciones,
-- pero volver a CREATE OR REPLACE las recrea con el default publico)
GRANT EXECUTE ON FUNCTION public.get_key_account_health_score(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_key_account_financial_summary(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_key_accounts() TO PUBLIC;

-- ============================================================
-- Revertir H-02: restaurar GRANT UPDATE sin restriccion de columnas
-- ============================================================
REVOKE UPDATE ON public.key_accounts FROM authenticated;
GRANT UPDATE ON public.key_accounts TO authenticated;

-- ============================================================
-- Revertir C-01: restaurar las 6 funciones KPI sin tenant_id filter
-- ============================================================
-- Nota: restauramos al estado de 034/053 (sin filtro explicito de tenant_id)

-- C-01a. get_total_sales (estado de migration 053)
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

-- C-01b. get_monthly_revenue_split (estado de migration 034)
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

GRANT EXECUTE ON FUNCTION public.get_monthly_revenue_split(int) TO authenticated;

-- C-01c. get_monthly_churn (estado de migration 034)
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

GRANT EXECUTE ON FUNCTION public.get_monthly_churn(int) TO authenticated;

-- C-01d. get_monthly_ticket (estado de migration 034)
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

GRANT EXECUTE ON FUNCTION public.get_monthly_ticket(int) TO authenticated;

-- C-01e. get_client_trends (estado de migration 034)
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

GRANT EXECUTE ON FUNCTION public.get_client_trends(int) TO authenticated;

-- C-01f. get_monthly_value (estado de migration 034)
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

GRANT EXECUTE ON FUNCTION public.get_monthly_value(int) TO authenticated;

-- ============================================================
-- NOTIFICAR PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
