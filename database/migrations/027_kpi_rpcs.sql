-- Migration 027: RPCs para KPIs del dashboard + vista segura client_rankings
-- Fecha: 2026-02-27
-- Fase: 7 (Sesion 2 — Frontend)
--
-- QUE HACE:
-- Crea funciones SQL (RPCs) que PostgREST expone como endpoints REST.
-- El frontend las llama via supabase.rpc('nombre', { params }).
-- No necesitan SECURITY DEFINER porque las tablas tienen RLS —
-- cada funcion solo ve datos del tenant autenticado.
--
-- CONCEPTO CLAVE - RPC (Remote Procedure Call):
-- Es como llamar a una funcion remota. El frontend dice:
-- "dame la facturacion mensual de los ultimos 6 meses"
-- y PostgREST ejecuta la funcion SQL y devuelve los resultados.
-- La seguridad la maneja RLS: el usuario solo ve sus datos.
--
-- TAMBIEN CREA:
-- client_rankings_secure: VIEW segura sobre la MV client_rankings.
-- La MV no tiene RLS (PostgreSQL no lo soporta en MVs).
-- La VIEW filtra por get_current_tenant_id() del JWT.
--
-- Rollback: database/migrations/027_rollback.sql

BEGIN;

-- ============================================================
-- 1. Vista segura: client_rankings_secure
-- ============================================================
-- Wrap de la MV client_rankings con filtro de tenant.
-- PostgREST la expone como tabla queryable.
-- El frontend la consulta como: supabase.from('client_rankings_secure')

CREATE OR REPLACE VIEW public.client_rankings_secure AS
SELECT
    customer_id,
    name,
    total_orders,
    total_revenue,
    avg_ticket,
    last_purchase,
    avg_days_between_purchases,
    ranking
FROM public.client_rankings
WHERE tenant_id = get_current_tenant_id();

GRANT SELECT ON public.client_rankings_secure TO authenticated;

-- ============================================================
-- 2. RPC: Facturacion mensual recurrente vs nueva
-- ============================================================
-- Retorna por mes: total, recurrente (clientes con 2+ compras),
-- nueva (clientes con 1 compra), y % recurrente.
--
-- "Recurrente" usa el total_purchases_count ACTUAL del cliente.
-- No es el count al momento de la orden, sino el estado actual.
-- Esto es intencional: muestra el mix de revenue del negocio HOY.

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

GRANT EXECUTE ON FUNCTION public.get_monthly_revenue_split(int)
    TO authenticated;

-- ============================================================
-- 3. RPC: Churn mensual
-- ============================================================
-- Para cada mes: cuantos clientes estaban activos el mes anterior
-- y NO compraron en el mes actual.
--
-- CONCEPTO: Churn = clientes que "se fueron". Si en enero tenia
-- 50 clientes activos y en febrero solo 40 compraron, el churn
-- es 10/50 = 20%.

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
        -- Clientes activos por mes (al menos 1 orden completada)
        SELECT DISTINCT
            date_trunc('month', o.order_date)::date AS month,
            o.customer_id
        FROM orders o
        WHERE o.status = 'completed'
    ),
    month_pairs AS (
        -- Para cada cliente activo en mes M, verificar si compro en M+1
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

GRANT EXECUTE ON FUNCTION public.get_monthly_churn(int)
    TO authenticated;

-- ============================================================
-- 4. RPC: Ticket promedio mensual
-- ============================================================
-- Ticket promedio por mes, separado en recurrente vs nuevo.
-- Util para ver si los clientes nuevos compran menos que los
-- recurrentes (generalmente si).

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

GRANT EXECUTE ON FUNCTION public.get_monthly_ticket(int)
    TO authenticated;

-- ============================================================
-- 5. RPC: Valor generado por PymePilot
-- ============================================================
-- Suma el monto de las ordenes atribuidas a predicciones de PymePilot.
-- Solo cuenta predicciones con status='completed' que tienen
-- attribution_amount en su metadata.

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

GRANT EXECUTE ON FUNCTION public.get_monthly_value(int)
    TO authenticated;

-- ============================================================
-- 6. RPC: Top productos de un cliente (para panel expandible)
-- ============================================================
-- Retorna los top N productos de un cliente por cantidad total.

CREATE OR REPLACE FUNCTION public.get_client_top_products(
    p_customer_id uuid,
    p_limit int DEFAULT 5
)
RETURNS TABLE (
    product_name text,
    total_quantity numeric,
    total_revenue numeric,
    times_ordered bigint
) AS $$
    SELECT
        pr.name AS product_name,
        SUM(oi.quantity) AS total_quantity,
        SUM(oi.total_price) AS total_revenue,
        COUNT(*) AS times_ordered
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products pr ON pr.id = oi.product_id
    WHERE o.customer_id = p_customer_id
      AND o.status = 'completed'
      AND oi.product_id IS NOT NULL
      AND pr.name NOT IN ('SHIPPING', 'COMISIONES')
    GROUP BY pr.name
    ORDER BY SUM(oi.total_price) DESC
    LIMIT p_limit;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_client_top_products(uuid, int)
    TO authenticated;

-- ============================================================
-- 7. Notificar a PostgREST del cambio de schema
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
