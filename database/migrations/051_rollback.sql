-- ============================================================
-- Rollback 051: Revertir get_demand_projection con rubro
-- ============================================================
-- QUE HACE: Revierte la migracion 051_demand_projection_by_rubro.sql
--   - Elimina la version con rubro y sin limite fijo
--   - Restaura la version anterior de migration 048
-- ============================================================

BEGIN;

-- Restaurar la funcion sin campo product_rubro (estado de migration 048)
DROP FUNCTION IF EXISTS public.get_demand_projection(int);

CREATE OR REPLACE FUNCTION public.get_demand_projection(
    p_limit int DEFAULT 30
)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    product_sku text,
    projected_demand_30d numeric,
    avg_monthly_units numeric,
    trend_pct numeric,
    unique_customers bigint,
    top_customer_name text,
    top_customer_units numeric
)
LANGUAGE sql STABLE
AS $$
WITH
date_range AS (
    SELECT
        (date_trunc('month', CURRENT_DATE) - INTERVAL '6 months')::date AS start_date,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::date AS mid_date,
        CURRENT_DATE AS end_date
),
monthly_units AS (
    SELECT
        oi.product_id,
        date_trunc('month', o.order_date)::date AS month,
        SUM(oi.quantity) AS units
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    CROSS JOIN date_range dr
    WHERE o.tenant_id = get_current_tenant_id()
      AND o.status = 'completed'
      AND oi.product_id IS NOT NULL
      AND o.order_date >= dr.start_date
    GROUP BY oi.product_id, date_trunc('month', o.order_date)::date
),
product_avg AS (
    SELECT
        product_id,
        AVG(units) AS avg_units,
        COUNT(DISTINCT month) AS months_active
    FROM monthly_units
    GROUP BY product_id
),
recent_avg AS (
    SELECT mu.product_id, AVG(mu.units) AS avg_recent
    FROM monthly_units mu CROSS JOIN date_range dr
    WHERE mu.month >= dr.mid_date
    GROUP BY mu.product_id
),
previous_avg AS (
    SELECT mu.product_id, AVG(mu.units) AS avg_previous
    FROM monthly_units mu CROSS JOIN date_range dr
    WHERE mu.month >= dr.start_date AND mu.month < dr.mid_date
    GROUP BY mu.product_id
),
customer_counts AS (
    SELECT oi.product_id, COUNT(DISTINCT o.customer_id) AS unique_customers
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    CROSS JOIN date_range dr
    WHERE o.tenant_id = get_current_tenant_id()
      AND o.status = 'completed'
      AND oi.product_id IS NOT NULL
      AND o.order_date >= dr.start_date
    GROUP BY oi.product_id
),
top_customers AS (
    SELECT DISTINCT ON (oi.product_id)
        oi.product_id,
        c.name AS customer_name,
        SUM(oi.quantity) AS total_units
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN customers c ON c.id = o.customer_id
    CROSS JOIN date_range dr
    WHERE o.tenant_id = get_current_tenant_id()
      AND o.status = 'completed'
      AND oi.product_id IS NOT NULL
      AND o.order_date >= dr.start_date
    GROUP BY oi.product_id, c.name
    ORDER BY oi.product_id, SUM(oi.quantity) DESC
)
SELECT
    p.id AS product_id,
    p.name AS product_name,
    COALESCE(p.sku, '') AS product_sku,
    ROUND(COALESCE(
        (COALESCE(ra.avg_recent, 0) * 2 + COALESCE(pa.avg_previous, 0)) / NULLIF(
            CASE WHEN ra.avg_recent IS NOT NULL AND pa.avg_previous IS NOT NULL THEN 3
                 WHEN ra.avg_recent IS NOT NULL THEN 2
                 ELSE 1 END, 0),
        pav.avg_units
    )) AS projected_demand_30d,
    ROUND(pav.avg_units) AS avg_monthly_units,
    CASE
        WHEN pa.avg_previous IS NOT NULL AND pa.avg_previous > 0
        THEN ROUND(((COALESCE(ra.avg_recent, 0) - pa.avg_previous) / pa.avg_previous * 100)::numeric, 1)
        ELSE 0
    END AS trend_pct,
    COALESCE(cc.unique_customers, 0) AS unique_customers,
    COALESCE(tc.customer_name, '') AS top_customer_name,
    COALESCE(tc.total_units, 0) AS top_customer_units
FROM product_avg pav
JOIN products p ON p.id = pav.product_id
LEFT JOIN recent_avg ra ON ra.product_id = pav.product_id
LEFT JOIN previous_avg pa ON pa.product_id = pav.product_id
LEFT JOIN customer_counts cc ON cc.product_id = pav.product_id
LEFT JOIN top_customers tc ON tc.product_id = pav.product_id
WHERE p.name NOT IN ('SHIPPING', 'COMISIONES', 'BONIFICACIONES', 'FLETE INTERNACIONAL', 'FULLFILMENT COMISIONES', 'PROYECTOS')
ORDER BY projected_demand_30d DESC NULLS LAST
LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_demand_projection IS
    'Productos con mas demanda proyectada (rollback a version sin rubro).';

GRANT EXECUTE ON FUNCTION public.get_demand_projection(int) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
