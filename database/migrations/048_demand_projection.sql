-- =============================================================================
-- Migracion 048: RPCs para proyeccion de demanda
-- =============================================================================
-- EJECUTAR CONTRA: orion_db (via postgres superuser)
-- Que hace:
--   1. get_demand_projection() — top productos con demanda proyectada a 30 dias
--   2. get_demand_projection_detail(product_id) — desglose por cliente
-- Por que: El dueno del negocio necesita saber cuantas unidades de cada producto
--   necesita para el proximo mes y que clientes generan la demanda.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. get_demand_projection: vista global de demanda por producto
-- =============================================================================
-- Calcula para cada producto:
--   - Promedio mensual de unidades (ultimos 6 meses con datos)
--   - Demanda proyectada a 30 dias (promedio ponderado: ultimos 3m pesan doble)
--   - Tendencia: comparar ultimos 3m vs 3m anteriores
--   - Cantidad de clientes unicos que lo compran
--   - Top cliente (el que mas unidades compra)

CREATE OR REPLACE FUNCTION public.get_demand_projection(
    p_limit int DEFAULT 15
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
-- Ventana de analisis: ultimos 6 meses
date_range AS (
    SELECT
        (date_trunc('month', CURRENT_DATE) - INTERVAL '6 months')::date AS start_date,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::date AS mid_date,
        CURRENT_DATE AS end_date
),
-- Unidades por producto por mes
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
-- Promedio mensual global por producto
product_avg AS (
    SELECT
        product_id,
        AVG(units) AS avg_units,
        COUNT(DISTINCT month) AS months_active
    FROM monthly_units
    GROUP BY product_id
),
-- Promedio ultimos 3 meses (periodo reciente — pesa mas)
recent_avg AS (
    SELECT
        mu.product_id,
        AVG(mu.units) AS avg_recent
    FROM monthly_units mu
    CROSS JOIN date_range dr
    WHERE mu.month >= dr.mid_date
    GROUP BY mu.product_id
),
-- Promedio 3 meses anteriores (periodo anterior)
previous_avg AS (
    SELECT
        mu.product_id,
        AVG(mu.units) AS avg_previous
    FROM monthly_units mu
    CROSS JOIN date_range dr
    WHERE mu.month >= dr.start_date AND mu.month < dr.mid_date
    GROUP BY mu.product_id
),
-- Clientes unicos por producto
customer_counts AS (
    SELECT
        oi.product_id,
        COUNT(DISTINCT o.customer_id) AS unique_customers
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    CROSS JOIN date_range dr
    WHERE o.tenant_id = get_current_tenant_id()
      AND o.status = 'completed'
      AND oi.product_id IS NOT NULL
      AND o.order_date >= dr.start_date
    GROUP BY oi.product_id
),
-- Top cliente por producto (el que mas unidades compro)
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
    -- Proyeccion 30d: promedio ponderado (reciente x2, anterior x1) / 3
    ROUND(COALESCE(
        (COALESCE(ra.avg_recent, 0) * 2 + COALESCE(pa.avg_previous, 0)) / NULLIF(
            CASE WHEN ra.avg_recent IS NOT NULL AND pa.avg_previous IS NOT NULL THEN 3
                 WHEN ra.avg_recent IS NOT NULL THEN 2
                 ELSE 1 END, 0),
        pav.avg_units
    )) AS projected_demand_30d,
    ROUND(pav.avg_units) AS avg_monthly_units,
    -- Tendencia %: (reciente - anterior) / anterior * 100
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
WHERE p.name NOT IN ('SHIPPING', 'COMISIONES')
ORDER BY projected_demand_30d DESC NULLS LAST
LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_demand_projection IS
    'Top N productos con demanda proyectada a 30 dias. Incluye tendencia, clientes y top comprador.';

GRANT EXECUTE ON FUNCTION public.get_demand_projection(int) TO authenticated;


-- =============================================================================
-- 2. get_demand_projection_detail: desglose por cliente para un producto
-- =============================================================================
-- Para cada cliente que compra el producto, muestra:
--   - Ultima compra (fecha y cantidad)
--   - Promedio de unidades por compra
--   - Frecuencia (dias entre compras)
--   - Proxima compra estimada
--   - Demanda estimada (promedio ponderado)

CREATE OR REPLACE FUNCTION public.get_demand_projection_detail(
    p_product_id uuid
)
RETURNS TABLE (
    customer_id uuid,
    customer_name text,
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
-- Todas las compras del producto por cliente (ultimos 12 meses)
purchases AS (
    SELECT
        o.customer_id,
        c.name AS customer_name,
        o.order_date,
        oi.quantity,
        ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.order_date DESC) AS rn
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN customers c ON c.id = o.customer_id
    WHERE o.tenant_id = get_current_tenant_id()
      AND o.status = 'completed'
      AND oi.product_id = p_product_id
      AND o.order_date >= CURRENT_DATE - INTERVAL '12 months'
),
-- Estadisticas por cliente
customer_stats AS (
    SELECT
        customer_id,
        MAX(customer_name) AS customer_name,
        MAX(order_date) AS last_order_date,
        -- Ultima cantidad (rn=1)
        MAX(CASE WHEN rn = 1 THEN quantity END) AS last_quantity,
        -- Promedio ponderado: las ultimas 3 compras pesan mas
        CASE
            WHEN COUNT(*) >= 3 THEN
                (SUM(CASE WHEN rn <= 3 THEN quantity * 2.0 ELSE quantity * 1.0 END)
                / (LEAST(COUNT(*), 3) * 2.0 + GREATEST(COUNT(*) - 3, 0) * 1.0))
            ELSE AVG(quantity)
        END AS avg_quantity,
        -- Frecuencia: diferencia promedio entre compras
        CASE
            WHEN COUNT(*) >= 2 THEN
                (MAX(order_date) - MIN(order_date))::numeric / NULLIF(COUNT(*) - 1, 0)
            ELSE NULL
        END AS frequency_days,
        COUNT(*) AS purchase_count
    FROM purchases
    GROUP BY customer_id
)
SELECT
    cs.customer_id,
    cs.customer_name,
    cs.last_order_date,
    cs.last_quantity::integer,
    ROUND(cs.avg_quantity, 1) AS avg_quantity,
    ROUND(cs.frequency_days, 0) AS frequency_days,
    -- Proxima compra estimada: ultima compra + frecuencia
    CASE
        WHEN cs.frequency_days IS NOT NULL
        THEN (cs.last_order_date + cs.frequency_days::integer)
        ELSE NULL
    END AS next_purchase_estimate,
    ROUND(cs.avg_quantity) AS demand_estimate
FROM customer_stats cs
ORDER BY cs.avg_quantity DESC;
$$;

COMMENT ON FUNCTION public.get_demand_projection_detail IS
    'Desglose de demanda por cliente para un producto. Incluye frecuencia y proxima compra estimada.';

GRANT EXECUTE ON FUNCTION public.get_demand_projection_detail(uuid) TO authenticated;


-- =============================================================================
-- 3. Notificar PostgREST
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
