-- Migration 028: RPCs para detalle de clientes — tendencia + facturacion mensual
-- Fecha: 2026-02-28
-- Fase: 7 (Sesion 3 — Omisiones)
--
-- QUE HACE:
-- Crea 2 funciones SQL que PostgREST expone como endpoints REST:
-- 1. get_client_trends: Compara facturacion reciente vs anterior por cliente
-- 2. get_client_monthly_revenue: Facturacion mensual de un cliente especifico
--
-- No necesitan SECURITY DEFINER porque las tablas tienen RLS —
-- cada funcion solo ve datos del tenant autenticado.
--
-- Rollback: database/migrations/028_rollback.sql

BEGIN;

-- ============================================================
-- 1. RPC: Tendencia de facturacion por cliente
-- ============================================================
-- Compara los ultimos p_months_window meses vs los p_months_window
-- meses anteriores. Si la diferencia supera 10%, es 'up' o 'down'.
-- Sino, 'stable'. Esto evita marcar como tendencia cambios
-- insignificantes (ruido estadistico).
--
-- Ejemplo con p_months_window = 3 (default):
-- recent = ene-feb-mar, previous = oct-nov-dic
-- Si recent es 15% mayor que previous => 'up'

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

GRANT EXECUTE ON FUNCTION public.get_client_trends(int)
    TO authenticated;

-- ============================================================
-- 2. RPC: Facturacion mensual de un cliente
-- ============================================================
-- Retorna facturacion por mes de un cliente especifico.
-- Se llama on-demand al expandir la fila en el ranking (lazy load).
-- Misma estrategia que get_client_top_products.

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

GRANT EXECUTE ON FUNCTION public.get_client_monthly_revenue(uuid, int)
    TO authenticated;

-- ============================================================
-- 3. Notificar a PostgREST del cambio de schema
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
