-- =============================================================================
-- Migracion 050: Agregar purchase_count a get_client_demand_detail
-- =============================================================================
-- Que hace: Reemplaza la RPC para incluir cantidad de compras por SKU.
--   Esto permite al frontend clasificar por confianza (3+ = alta, 1-2 = baja).
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
    demand_estimate numeric,
    purchase_count bigint
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
        CASE
            WHEN COUNT(*) >= 3 THEN
                (SUM(CASE WHEN rn <= 3 THEN quantity * 2.0 ELSE quantity * 1.0 END)
                / (LEAST(COUNT(*), 3) * 2.0 + GREATEST(COUNT(*) - 3, 0) * 1.0))
            ELSE AVG(quantity)
        END AS avg_quantity,
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
    ROUND(ps.avg_quantity) AS demand_estimate,
    ps.purchase_count
FROM product_stats ps
ORDER BY ps.purchase_count DESC, ROUND(ps.avg_quantity) DESC;
$$;

COMMENT ON FUNCTION public.get_client_demand_detail IS
    'SKUs de un cliente con cantidad, frecuencia, proyeccion y purchase_count para filtrar por confianza.';

NOTIFY pgrst, 'reload schema';
