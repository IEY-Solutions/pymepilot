-- Rollback 045: revertir RPCs de ranking de productos
-- EJECUTAR CONTRA: orion_db

BEGIN;

DROP FUNCTION IF EXISTS public.get_product_rankings();

-- Restaurar get_client_top_products con default 5
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

NOTIFY pgrst, 'reload schema';

COMMIT;
