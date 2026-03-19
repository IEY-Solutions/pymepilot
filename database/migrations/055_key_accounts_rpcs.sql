-- =============================================================================
-- Migracion 055: RPCs para Cuentas Clave
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace:
--   1. get_key_account_health_score() — calcula semaforo automatico
--   2. get_key_account_financial_summary() — resumen financiero de un cliente
--   3. suggest_key_accounts() — sugiere clientes para marcar como cuenta clave
-- Por que: Estas funciones se ejecutan en la DB (mas rapido que en el frontend)
--   y encapsulan logica de negocio compleja que seria dificil de mantener en JS.
-- Nota: get_client_top_products() ya existe en 045_product_rankings_rpc.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. get_key_account_health_score: calcula el semaforo de salud
-- =============================================================================
-- Logica:
--   Verde: compro en ultimos 30d + sin alertas urgentes + sin acciones vencidas
--   Amarillo: 30-60d sin compra, O acciones vencidas, O bajo >20%
--   Rojo: 60+d sin compra, O bajo >40%, O alertas criticas sin resolver

CREATE OR REPLACE FUNCTION public.get_key_account_health_score(
    p_customer_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
    v_last_purchase_days integer;
    v_revenue_current numeric;
    v_revenue_previous numeric;
    v_revenue_change numeric;
    v_active_alerts integer;
    v_overdue_actions integer;
BEGIN
    v_tenant_id := get_current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant context set';
    END IF;

    -- Dias desde ultima compra
    SELECT COALESCE(
        EXTRACT(DAY FROM NOW() - MAX(o.order_date))::integer,
        999
    )
    INTO v_last_purchase_days
    FROM orders o
    WHERE o.customer_id = p_customer_id
      AND o.tenant_id = v_tenant_id
      AND o.status = 'completed';

    -- Facturacion ultimos 2 meses (actual vs anterior)
    SELECT COALESCE(SUM(
        CASE WHEN o.order_date >= DATE_TRUNC('month', CURRENT_DATE)
             THEN o.total_amount ELSE 0 END
    ), 0),
    COALESCE(SUM(
        CASE WHEN o.order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
             AND o.order_date < DATE_TRUNC('month', CURRENT_DATE)
             THEN o.total_amount ELSE 0 END
    ), 0)
    INTO v_revenue_current, v_revenue_previous
    FROM orders o
    WHERE o.customer_id = p_customer_id
      AND o.tenant_id = v_tenant_id
      AND o.status = 'completed'
      AND o.order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month';

    -- Calcular cambio porcentual de facturacion
    IF v_revenue_previous > 0 THEN
        v_revenue_change := ((v_revenue_current - v_revenue_previous) / v_revenue_previous) * 100;
    ELSE
        v_revenue_change := 0;
    END IF;

    -- Alertas activas (pending + triggered)
    SELECT COUNT(*)
    INTO v_active_alerts
    FROM key_account_alerts kaa
    JOIN key_accounts ka ON ka.id = kaa.key_account_id
    WHERE ka.customer_id = p_customer_id
      AND ka.tenant_id = v_tenant_id
      AND kaa.status IN ('pending', 'triggered');

    -- Acciones vencidas (manuales con trigger_date pasada y status pending)
    SELECT COUNT(*)
    INTO v_overdue_actions
    FROM key_account_alerts kaa
    JOIN key_accounts ka ON ka.id = kaa.key_account_id
    WHERE ka.customer_id = p_customer_id
      AND ka.tenant_id = v_tenant_id
      AND kaa.alert_type = 'manual'
      AND kaa.status = 'pending'
      AND kaa.trigger_date < NOW();

    -- Evaluar semaforo
    -- ROJO: 60+d sin compra, O bajo >40%, O alertas criticas
    IF v_last_purchase_days >= 60 OR v_revenue_change <= -40 THEN
        RETURN 'red';
    END IF;

    -- AMARILLO: 30-60d sin compra, O acciones vencidas, O bajo >20%
    IF v_last_purchase_days >= 30 OR v_overdue_actions > 0 OR v_revenue_change <= -20 THEN
        RETURN 'yellow';
    END IF;

    -- VERDE: todo bien
    RETURN 'green';
END;
$$;

COMMENT ON FUNCTION public.get_key_account_health_score IS
  'Calcula semaforo de salud de una cuenta clave: green/yellow/red basado en compras, facturacion y alertas.';

GRANT EXECUTE ON FUNCTION public.get_key_account_health_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_key_account_health_score(uuid) TO pymepilot_app;


-- =============================================================================
-- 2. get_key_account_financial_summary: resumen financiero de un cliente
-- =============================================================================
-- Retorna facturacion de los ultimos 3 meses, ticket promedio, total ordenes,
-- y la tendencia porcentual.

CREATE OR REPLACE FUNCTION public.get_key_account_financial_summary(
    p_customer_id uuid
)
RETURNS TABLE (
    month_label text,
    month_revenue numeric,
    order_count bigint,
    avg_ticket numeric,
    trend_pct numeric
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH monthly AS (
        SELECT
            TO_CHAR(DATE_TRUNC('month', o.order_date), 'YYYY-MM') AS month_label,
            SUM(o.total_amount) AS month_revenue,
            COUNT(*)::bigint AS order_count,
            ROUND(AVG(o.total_amount), 2) AS avg_ticket
        FROM orders o
        WHERE o.customer_id = p_customer_id
          AND o.tenant_id = get_current_tenant_id()
          AND o.status = 'completed'
          AND o.order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
        GROUP BY DATE_TRUNC('month', o.order_date)
        ORDER BY DATE_TRUNC('month', o.order_date) DESC
    ),
    with_trend AS (
        SELECT
            m.month_label,
            m.month_revenue,
            m.order_count,
            m.avg_ticket,
            CASE
                WHEN LAG(m.month_revenue) OVER (ORDER BY m.month_label) > 0
                THEN ROUND(
                    ((m.month_revenue - LAG(m.month_revenue) OVER (ORDER BY m.month_label))
                     / LAG(m.month_revenue) OVER (ORDER BY m.month_label)) * 100,
                    1
                )
                ELSE 0
            END AS trend_pct
        FROM monthly m
    )
    SELECT * FROM with_trend ORDER BY month_label DESC;
$$;

COMMENT ON FUNCTION public.get_key_account_financial_summary IS
  'Resumen financiero de un cliente: facturacion, ticket promedio y tendencia de los ultimos 3 meses.';

GRANT EXECUTE ON FUNCTION public.get_key_account_financial_summary(uuid) TO authenticated;


-- =============================================================================
-- 3. suggest_key_accounts: sugiere clientes para marcar como cuenta clave
-- =============================================================================
-- Criterio: clientes en el percentil 90 de facturacion (ultimos 6 meses)
-- que NO estan ya en key_accounts.

CREATE OR REPLACE FUNCTION public.suggest_key_accounts()
RETURNS TABLE (
    customer_id uuid,
    customer_name text,
    total_amount numeric,
    order_count bigint
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH customer_totals AS (
        SELECT
            o.customer_id,
            c.name AS customer_name,
            SUM(o.total_amount) AS total_amount,
            COUNT(*)::bigint AS order_count
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        WHERE o.tenant_id = get_current_tenant_id()
          AND o.status = 'completed'
          AND o.order_date >= CURRENT_DATE - INTERVAL '6 months'
          AND c.name NOT IN ('SHIPPING', 'COMISIONES')
        GROUP BY o.customer_id, c.name
    ),
    threshold AS (
        SELECT PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_amount) AS p90
        FROM customer_totals
    )
    SELECT
        ct.customer_id,
        ct.customer_name,
        ct.total_amount,
        ct.order_count
    FROM customer_totals ct, threshold t
    WHERE ct.total_amount >= t.p90
      AND NOT EXISTS (
          SELECT 1 FROM key_accounts ka
          WHERE ka.customer_id = ct.customer_id
            AND ka.tenant_id = get_current_tenant_id()
      )
    ORDER BY ct.total_amount DESC;
$$;

COMMENT ON FUNCTION public.suggest_key_accounts IS
  'Sugiere clientes como cuentas clave: percentil 90 de facturacion (6 meses) que no estan marcados aun.';

GRANT EXECUTE ON FUNCTION public.suggest_key_accounts() TO authenticated;


-- =============================================================================
-- 4. Notificar PostgREST
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
