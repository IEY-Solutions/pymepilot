-- ============================================================
-- Rollback 050: Revertir get_client_demand_detail v2
-- ============================================================
-- QUE HACE: Revierte la migracion 050_client_demand_detail_v2.sql
--   - Elimina la version con purchase_count
--   - Restaura la version anterior sin purchase_count
-- ============================================================

BEGIN;

-- Restaurar la funcion sin purchase_count (estado de migration 049)
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
        END AS frequency_days
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
    'SKUs de un cliente con cantidad, frecuencia y proyeccion (rollback a version sin purchase_count).';

NOTIFY pgrst, 'reload schema';

COMMIT;
