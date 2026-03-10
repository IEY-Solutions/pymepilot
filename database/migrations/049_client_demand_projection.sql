-- =============================================================================
-- Migracion 049: RPCs para proyeccion de demanda por cliente
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace:
--   1. get_client_demand_projection() — top 15 clientes por facturacion con frecuencia
--   2. get_client_demand_detail(customer_id) — SKUs del cliente con proyeccion
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. get_client_demand_projection: top clientes con comportamiento de compra
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_client_demand_projection(
    p_limit int DEFAULT 15
)
RETURNS TABLE (
    customer_id uuid,
    customer_name text,
    total_revenue numeric,
    total_orders bigint,
    avg_ticket numeric,
    frequency_days numeric,
    last_order_date date,
    next_purchase_estimate date
)
LANGUAGE sql STABLE
AS $$
WITH
date_range AS (
    SELECT (date_trunc('month', CURRENT_DATE) - INTERVAL '6 months')::date AS start_date
),
-- Ordenes por cliente en los ultimos 6 meses
client_orders AS (
    SELECT
        o.customer_id,
        c.name AS customer_name,
        SUM(o.total_amount) AS total_revenue,
        COUNT(*)::bigint AS total_orders,
        AVG(o.total_amount) AS avg_ticket,
        MAX(o.order_date) AS last_order_date,
        MIN(o.order_date) AS first_order_date
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    CROSS JOIN date_range dr
    WHERE o.tenant_id = get_current_tenant_id()
      AND o.status = 'completed'
      AND o.order_date >= dr.start_date
    GROUP BY o.customer_id, c.name
)
SELECT
    co.customer_id,
    co.customer_name,
    ROUND(co.total_revenue, 2) AS total_revenue,
    co.total_orders,
    ROUND(co.avg_ticket, 2) AS avg_ticket,
    -- Frecuencia: dias entre primera y ultima compra / (ordenes - 1)
    CASE
        WHEN co.total_orders >= 2
        THEN ROUND((co.last_order_date - co.first_order_date)::numeric / (co.total_orders - 1), 0)
        ELSE NULL
    END AS frequency_days,
    co.last_order_date,
    -- Proxima compra: ultima + frecuencia
    CASE
        WHEN co.total_orders >= 2
        THEN co.last_order_date + ((co.last_order_date - co.first_order_date)::numeric / (co.total_orders - 1))::integer
        ELSE NULL
    END AS next_purchase_estimate
FROM client_orders co
ORDER BY co.total_revenue DESC
LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_client_demand_projection IS
    'Top N clientes por facturacion (6 meses) con frecuencia y proxima compra estimada.';

GRANT EXECUTE ON FUNCTION public.get_client_demand_projection(int) TO authenticated;


-- =============================================================================
-- 2. get_client_demand_detail: SKUs de un cliente con proyeccion
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_client_demand_detail(
    p_customer_id uuid
)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    product_sku text,
    last_order_date date,
    last_quantity integer,
    avg_quantity numeric,
    frequency_days numeric,
    next_purchase_estimate date,
    demand_estimate numeric
)
LANGUAGE sql STABLE
AS $$
WITH
purchases AS (
    SELECT
        oi.product_id,
        p.name AS product_name,
        COALESCE(p.sku, '') AS product_sku,
        o.order_date,
        oi.quantity,
        ROW_NUMBER() OVER (PARTITION BY oi.product_id ORDER BY o.order_date DESC) AS rn
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.customer_id = p_customer_id
      AND o.tenant_id = get_current_tenant_id()
      AND o.status = 'completed'
      AND oi.product_id IS NOT NULL
      AND p.name NOT IN ('SHIPPING', 'COMISIONES')
      AND o.order_date >= CURRENT_DATE - INTERVAL '12 months'
),
product_stats AS (
    SELECT
        product_id,
        MAX(product_name) AS product_name,
        MAX(product_sku) AS product_sku,
        MAX(order_date) AS last_order_date,
        MIN(order_date) AS first_order_date,
        MAX(CASE WHEN rn = 1 THEN quantity END) AS last_quantity,
        -- Promedio ponderado: ultimas 3 compras pesan doble
        CASE
            WHEN COUNT(*) >= 3 THEN
                (SUM(CASE WHEN rn <= 3 THEN quantity * 2.0 ELSE quantity * 1.0 END)
                / (LEAST(COUNT(*), 3) * 2.0 + GREATEST(COUNT(*) - 3, 0) * 1.0))
            ELSE AVG(quantity)
        END AS avg_quantity,
        -- Frecuencia entre compras de este producto
        CASE
            WHEN COUNT(*) >= 2 THEN
                (MAX(order_date) - MIN(order_date))::numeric / NULLIF(COUNT(*) - 1, 0)
            ELSE NULL
        END AS frequency_days,
        COUNT(*) AS purchase_count
    FROM purchases
    GROUP BY product_id
)
SELECT
    ps.product_id,
    ps.product_name,
    ps.product_sku,
    ps.last_order_date,
    ps.last_quantity::integer,
    ROUND(ps.avg_quantity, 1) AS avg_quantity,
    ROUND(ps.frequency_days, 0) AS frequency_days,
    CASE
        WHEN ps.frequency_days IS NOT NULL
        THEN (ps.last_order_date + ps.frequency_days::integer)
        ELSE NULL
    END AS next_purchase_estimate,
    ROUND(ps.avg_quantity) AS demand_estimate
FROM product_stats ps
ORDER BY ROUND(ps.avg_quantity) DESC;
$$;

COMMENT ON FUNCTION public.get_client_demand_detail IS
    'SKUs de un cliente con cantidad, frecuencia y proxima compra estimada.';

GRANT EXECUTE ON FUNCTION public.get_client_demand_detail(uuid) TO authenticated;

-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
