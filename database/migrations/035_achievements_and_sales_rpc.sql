-- Migration 035: RPCs para /logros y Ventas Realizadas
-- Fecha: 2026-03-06
-- Fase: 10 Bloque C — Mejoras UX Dashboard
--
-- QUE HACE:
-- Crea 3 funciones SQL (RPCs) que PostgREST expone como endpoints REST:
--   1. get_achievements: Predicciones convertidas en ventas (para /logros)
--   2. get_total_sales: Conteo y monto de ordenes por mes (para /metricas)
--   3. get_streak_days: Dias habiles consecutivos con conversiones
--
-- SEGURIDAD:
-- Sin SECURITY DEFINER — RLS filtra por tenant automaticamente.
-- GRANT EXECUTE solo a authenticated.
--
-- Rollback: database/migrations/035_rollback.sql

BEGIN;

-- ============================================================
-- 1. RPC: get_achievements — Predicciones convertidas en ventas
-- ============================================================
-- JOIN predictions (completed) + customers + orders + order_items.
-- Retorna detalle de cada conversion: cliente, monto, productos,
-- patron de recompra (total_orders, avg_days_between_purchases).
--
-- El frontend usa esto para mostrar la pagina /logros con cards
-- motivacionales que le dicen al vendedor "tu gestion funciono".

CREATE OR REPLACE FUNCTION public.get_achievements(
    p_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS TABLE (
    prediction_id uuid,
    customer_name text,
    vertical text,
    attribution_date timestamptz,
    attribution_amount numeric,
    products jsonb,
    total_orders bigint,
    avg_days_between_purchases numeric
) AS $$
    SELECT
        p.id AS prediction_id,
        c.name AS customer_name,
        p.vertical,
        (p.metadata->>'attribution_date')::timestamptz AS attribution_date,
        (p.metadata->>'attribution_amount')::numeric AS attribution_amount,
        COALESCE(
            (
                SELECT jsonb_agg(jsonb_build_object(
                    'name', pr.name,
                    'quantity', oi.quantity,
                    'total_price', oi.total_price
                ))
                FROM order_items oi
                JOIN products pr ON pr.id = oi.product_id
                WHERE oi.order_id = (p.metadata->>'attribution_order_id')::uuid
                  AND pr.name NOT IN ('SHIPPING', 'COMISIONES')
            ),
            '[]'::jsonb
        ) AS products,
        (
            SELECT COUNT(*)
            FROM orders o2
            WHERE o2.customer_id = c.id
              AND o2.tenant_id = c.tenant_id
              AND o2.status = 'completed'
        ) AS total_orders,
        c.avg_days_between_purchases
    FROM predictions p
    JOIN customers c ON c.id = p.customer_id AND c.tenant_id = p.tenant_id
    WHERE p.status = 'completed'
      AND p.metadata ? 'attribution_amount'
      AND date_trunc('month', (p.metadata->>'attribution_date')::timestamptz)::date
          = p_month
    ORDER BY (p.metadata->>'attribution_date')::timestamptz DESC
    LIMIT 50;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_achievements(date)
    TO authenticated;

-- ============================================================
-- 2. RPC: get_total_sales — Ordenes por mes
-- ============================================================
-- COUNT + SUM sobre orders con status='completed', agrupado por mes.
-- El frontend lo usa para la card "Ventas del Mes" en /metricas
-- con comparacion vs mes anterior.

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

GRANT EXECUTE ON FUNCTION public.get_total_sales(int)
    TO authenticated;

-- ============================================================
-- 3. RPC: get_streak_days — Racha de conversiones
-- ============================================================
-- Cuenta dias habiles consecutivos (lun-vie) con al menos 1 conversion.
-- Se resetea si pasa un dia habil sin conversiones.
-- Retorna un solo int.

CREATE OR REPLACE FUNCTION public.get_streak_days()
RETURNS int AS $$
DECLARE
    streak int := 0;
    check_date date := CURRENT_DATE;
    has_conversion boolean;
BEGIN
    -- Retrocedemos dia a dia desde hoy
    LOOP
        -- Saltear fines de semana (sabado=6, domingo=0)
        IF EXTRACT(DOW FROM check_date) IN (0, 6) THEN
            check_date := check_date - 1;
            CONTINUE;
        END IF;

        -- Verificar si hubo al menos 1 conversion ese dia
        SELECT EXISTS(
            SELECT 1
            FROM predictions p
            WHERE p.status = 'completed'
              AND p.metadata ? 'attribution_date'
              AND (p.metadata->>'attribution_date')::date = check_date
        ) INTO has_conversion;

        IF has_conversion THEN
            streak := streak + 1;
            check_date := check_date - 1;
        ELSE
            EXIT;  -- Se rompio la racha
        END IF;

        -- Safety: no retroceder mas de 365 dias
        IF CURRENT_DATE - check_date > 365 THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN streak;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.get_streak_days()
    TO authenticated;

-- ============================================================
-- 4. Notificar a PostgREST del cambio de schema
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
