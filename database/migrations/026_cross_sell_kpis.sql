-- Migration 026: Cross-Sell (V3) + KPIs — Vistas materializadas e indices
-- Fecha: 2026-02-27
-- Fase: 7
--
-- QUE HACE:
-- 1. Crea vista materializada co_purchases: calcula que productos se
--    compran juntos (co-compras). V3 Cross-Sell usa esto para recomendar
--    productos que un cliente nunca compro pero otros similares si.
-- 2. Crea vista materializada client_rankings: ranking de clientes por
--    facturacion acumulada. El dashboard lo muestra en la tab "Clientes".
-- 3. Indices UNIQUE en las MVs (requeridos para REFRESH CONCURRENTLY).
-- 4. Indice en orders para queries mensuales de KPIs.
-- 5. Funcion refresh_materialized_views() como SECURITY DEFINER para que
--    pymepilot_app pueda refrescar las MVs sin ser superuser.
--
-- POR QUE VISTAS MATERIALIZADAS:
-- Calcular co-compras requiere cruzar order_items consigo misma (self-join)
-- y contar combinaciones. Con 280 comprobantes de IEY son milisegundos,
-- pero con mas clientes seria lento. La MV calcula una vez al dia (5 AM)
-- y las queries leen la "foto" instantaneamente.
--
-- CONCEPTO CLAVE - Self-Join:
-- Para encontrar pares de productos comprados juntos, juntamos order_items
-- consigo misma: oi1 y oi2 son filas de la MISMA tabla pero de DISTINTOS
-- productos en el MISMO pedido. Es como comparar una lista de compras
-- consigo misma para encontrar combinaciones frecuentes.
--
-- CONCEPTO CLAVE - REFRESH CONCURRENTLY:
-- Un refresh normal bloquea la vista (nadie puede leerla mientras se
-- recalcula). CONCURRENTLY permite que el dashboard siga leyendo los
-- datos viejos mientras se calculan los nuevos. Requiere un indice
-- UNIQUE en la vista.
--
-- SEGURIDAD:
-- Las MVs NO tienen RLS (PostgreSQL no soporta RLS en MVs).
-- SIEMPRE filtrar por tenant_id al consultar.
-- El refresh corre como SECURITY DEFINER (postgres superuser) para
-- poder leer datos de todos los tenants a traves de RLS.
--
-- Rollback: database/migrations/026_rollback.sql

BEGIN;

-- ============================================================
-- 1. Vista materializada: co_purchases (co-compras entre productos)
-- ============================================================
-- Cada fila dice: "Producto A y Producto B se compraron juntos N veces,
-- y eso representa X% de las veces que se compro Producto A."
--
-- Ejemplo: Si la Funda MagSafe se compro 100 veces, y de esas 100
-- veces, 75 veces se compro junto con el Vidrio Templado, entonces
-- co_purchase_rate = 0.75 (75%).
--
-- HAVING >= 3: Solo pares con al menos 3 pedidos juntos (evitar
-- coincidencias casuales con solo 1-2 pedidos).

CREATE MATERIALIZED VIEW public.co_purchases AS
SELECT
    o.tenant_id,
    oi1.product_id AS product_a,
    pa.name AS product_a_name,
    oi2.product_id AS product_b,
    pb.name AS product_b_name,
    COUNT(DISTINCT o.id) AS times_bought_together,
    -- Tasa de co-compra: veces juntos / veces que se compro product_a
    COUNT(DISTINCT o.id)::float /
        NULLIF(
            (SELECT COUNT(DISTINCT o2.id)
             FROM orders o2
             JOIN order_items oi3 ON o2.id = oi3.order_id
             WHERE oi3.product_id = oi1.product_id
               AND o2.tenant_id = o.tenant_id),
            0
        ) AS co_purchase_rate
FROM order_items oi1
JOIN order_items oi2
    ON oi1.order_id = oi2.order_id
    AND oi1.product_id < oi2.product_id  -- Evitar pares duplicados (A,B) y (B,A)
JOIN orders o ON oi1.order_id = o.id
JOIN products pa ON pa.id = oi1.product_id
JOIN products pb ON pb.id = oi2.product_id
GROUP BY o.tenant_id, oi1.product_id, pa.name, oi2.product_id, pb.name
HAVING COUNT(DISTINCT o.id) >= 3
WITH NO DATA;  -- Se popula en el primer REFRESH

-- ============================================================
-- 2. Vista materializada: client_rankings (ranking por facturacion)
-- ============================================================
-- Cada fila tiene: cliente, total de pedidos, facturacion acumulada,
-- ticket promedio, ultima compra, frecuencia, y su posicion en el
-- ranking (PARTITION BY tenant_id = ranking independiente por tenant).

CREATE MATERIALIZED VIEW public.client_rankings AS
SELECT
    c.tenant_id,
    c.id AS customer_id,
    c.name,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.total_amount), 0) AS total_revenue,
    COALESCE(AVG(o.total_amount), 0) AS avg_ticket,
    MAX(o.order_date) AS last_purchase,
    c.avg_days_between_purchases,
    RANK() OVER (
        PARTITION BY c.tenant_id
        ORDER BY COALESCE(SUM(o.total_amount), 0) DESC
    ) AS ranking
FROM customers c
LEFT JOIN orders o
    ON c.id = o.customer_id
    AND c.tenant_id = o.tenant_id
    AND o.status = 'completed'
WHERE c.status = 'active'
GROUP BY c.tenant_id, c.id, c.name, c.avg_days_between_purchases
WITH NO DATA;  -- Se popula en el primer REFRESH

-- ============================================================
-- 3. Indices UNIQUE en vistas materializadas
-- ============================================================
-- Requeridos para REFRESH MATERIALIZED VIEW CONCURRENTLY
-- (sin bloquear lecturas durante el refresh).

CREATE UNIQUE INDEX idx_co_purchases_pk
    ON public.co_purchases (tenant_id, product_a, product_b);

CREATE UNIQUE INDEX idx_client_rankings_pk
    ON public.client_rankings (tenant_id, customer_id);

-- Indice adicional para buscar co-compras por producto especifico
-- (V3 busca "que se compra junto con producto X")
CREATE INDEX idx_co_purchases_product_a
    ON public.co_purchases (tenant_id, product_a);

CREATE INDEX idx_co_purchases_product_b
    ON public.co_purchases (tenant_id, product_b);

-- ============================================================
-- 4. Indice en orders para queries mensuales de KPIs
-- ============================================================
-- Las 4 queries de KPIs (facturacion, churn, ticket, valor) filtran
-- por tenant_id + order_date + customer_id. Este indice compuesto
-- optimiza todas al mismo tiempo.

CREATE INDEX IF NOT EXISTS idx_orders_monthly_kpis
    ON public.orders (tenant_id, order_date, customer_id);

-- ============================================================
-- 5. Permisos en vistas materializadas
-- ============================================================
-- pymepilot_app: SELECT (para queries del motor Python V3)
-- authenticated: SELECT (para PostgREST/frontend)
-- NOTA: No GRANT REFRESH — se hace via funcion SECURITY DEFINER

GRANT SELECT ON public.co_purchases TO pymepilot_app;
GRANT SELECT ON public.client_rankings TO pymepilot_app;
GRANT SELECT ON public.co_purchases TO authenticated;
GRANT SELECT ON public.client_rankings TO authenticated;

-- ============================================================
-- 6. Funcion para refrescar vistas materializadas
-- ============================================================
-- SECURITY DEFINER: se ejecuta como postgres (superuser), asi puede
-- leer datos de TODOS los tenants a traves de RLS para poblar las MVs.
-- pymepilot_app no podria hacer REFRESH directamente porque FORCE RLS
-- bloquearia el acceso a datos sin tenant context.
--
-- CONCEPTO CLAVE - SECURITY DEFINER:
-- Normalmente una funcion corre con los permisos de quien la llama.
-- SECURITY DEFINER la hace correr con los permisos de quien la CREO
-- (postgres = superuser). Es como una llave maestra que solo se usa
-- para una tarea especifica (refrescar vistas).

CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    -- CONCURRENTLY: no bloquea lecturas durante el refresh.
    -- Requiere UNIQUE index (creados arriba).
    -- Nota: la primera ejecucion despues de WITH NO DATA debe ser
    -- sin CONCURRENTLY porque la vista esta vacia.
    -- Usamos un bloque de excepcion para manejar ambos casos.
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.co_purchases;
    EXCEPTION WHEN OTHERS THEN
        -- Primera vez o error: refresh completo (con bloqueo)
        REFRESH MATERIALIZED VIEW public.co_purchases;
    END;

    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_rankings;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.client_rankings;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.refresh_materialized_views() IS
    'Refresca co_purchases y client_rankings. Corre como superuser (SECURITY DEFINER) para bypasear RLS. Solo pymepilot_app puede ejecutarla.';

GRANT EXECUTE ON FUNCTION public.refresh_materialized_views() TO pymepilot_app;

-- ============================================================
-- 7. Refresh inicial (poblar las vistas por primera vez)
-- ============================================================
-- Las MVs se crearon con WITH NO DATA, hay que poblarlas.
-- El primer refresh NO puede ser CONCURRENTLY (vista vacia).

REFRESH MATERIALIZED VIEW public.co_purchases;
REFRESH MATERIALIZED VIEW public.client_rankings;

-- ============================================================
-- 8. Notificar a PostgREST del cambio de schema
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
