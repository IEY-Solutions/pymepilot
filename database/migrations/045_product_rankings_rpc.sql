-- =============================================================================
-- Migracion 045: RPCs para ranking de productos y mejora top 10 por cliente
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace:
--   1. Crea RPC get_product_rankings() — ranking global de productos
--   2. Reemplaza get_client_top_products() — top 10 + ordenar por unidades o monto
-- Por que: El dashboard necesita una pestana de ranking de productos y el
--   detalle por cliente necesita top 10 (antes top 5) con opcion de ordenar.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. get_product_rankings: ranking global de productos por monto/unidades
-- =============================================================================
-- Devuelve todos los productos con ventas, con unidades y monto.
-- El frontend ordena client-side segun el toggle activo.

CREATE OR REPLACE FUNCTION public.get_product_rankings()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_sku text,
  total_units bigint,
  total_revenue numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    COALESCE(p.sku, '') AS product_sku,
    SUM(oi.quantity)::bigint AS total_units,
    SUM(oi.total_price) AS total_revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.tenant_id = get_current_tenant_id()
    AND o.status = 'completed'
    AND oi.product_id IS NOT NULL
    AND p.name NOT IN ('SHIPPING', 'COMISIONES')
  GROUP BY p.id, p.name, p.sku
  ORDER BY total_revenue DESC;
$$;

COMMENT ON FUNCTION public.get_product_rankings IS
  'Ranking global de productos por monto facturado. Incluye unidades y SKU.';

GRANT EXECUTE ON FUNCTION public.get_product_rankings() TO authenticated;


-- =============================================================================
-- 2. Reemplazar get_client_top_products: top 10 + unidades
-- =============================================================================
-- Cambios: default p_limit 5 → 10, ya incluia total_quantity.
-- La funcion ya existia, solo cambiamos el default.

CREATE OR REPLACE FUNCTION public.get_client_top_products(
    p_customer_id uuid,
    p_limit int DEFAULT 10
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

COMMENT ON FUNCTION public.get_client_top_products IS
  'Top N productos por monto para un cliente. Default 10 (antes 5).';


-- =============================================================================
-- 3. Notificar PostgREST
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
