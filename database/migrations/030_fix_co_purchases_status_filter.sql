-- ============================================================
-- Migration 030: Agregar filtro status='completed' a co_purchases
-- ============================================================
-- FIX M-04 (Auditoria Fase 7): La MV co_purchases incluia ordenes
-- canceladas, pendientes, o en cualquier estado. Los rates de
-- co-compra solo deben calcularse sobre ordenes completadas.
--
-- CONCEPTO: Las Materialized Views no se pueden ALTER — hay que
-- DROP + CREATE + REFRESH. Es como rehacer una "foto" desde cero
-- con un filtro mejorado.
--
-- NOTA: Los permisos se mantienen como post-fix H-01:
-- pymepilot_app: SELECT (motor Python V3)
-- authenticated: SIN acceso (H-01 revoко SELECT)
--
-- Rollback: database/migrations/030_rollback.sql

BEGIN;

-- 1. Dropear MV existente (CASCADE dropea indices automaticamente)
DROP MATERIALIZED VIEW IF EXISTS public.co_purchases CASCADE;

-- 2. Recrear con filtro status='completed' en ambos lugares:
--    - JOIN principal (solo ordenes completadas contribuyen al conteo)
--    - Subquery del rate (denominador: total de ordenes completadas del producto)
CREATE MATERIALIZED VIEW public.co_purchases AS
SELECT
    o.tenant_id,
    oi1.product_id AS product_a,
    pa.name AS product_a_name,
    oi2.product_id AS product_b,
    pb.name AS product_b_name,
    COUNT(DISTINCT o.id) AS times_bought_together,
    -- Tasa de co-compra: veces juntos / veces que se compro product_a
    -- (solo ordenes completadas en ambos conteos)
    COUNT(DISTINCT o.id)::float /
        NULLIF(
            (SELECT COUNT(DISTINCT o2.id)
             FROM orders o2
             JOIN order_items oi3 ON o2.id = oi3.order_id
             WHERE oi3.product_id = oi1.product_id
               AND o2.tenant_id = o.tenant_id
               AND o2.status = 'completed'),
            0
        ) AS co_purchase_rate
FROM order_items oi1
JOIN order_items oi2
    ON oi1.order_id = oi2.order_id
    AND oi1.product_id < oi2.product_id
JOIN orders o ON oi1.order_id = o.id
    AND o.status = 'completed'  -- Solo ordenes completadas
JOIN products pa ON pa.id = oi1.product_id
JOIN products pb ON pb.id = oi2.product_id
GROUP BY o.tenant_id, oi1.product_id, pa.name, oi2.product_id, pb.name
HAVING COUNT(DISTINCT o.id) >= 3
WITH NO DATA;

-- 3. Recrear indices (se perdieron con CASCADE)
CREATE UNIQUE INDEX idx_co_purchases_pk
    ON public.co_purchases (tenant_id, product_a, product_b);

CREATE INDEX idx_co_purchases_product_a
    ON public.co_purchases (tenant_id, product_a);

CREATE INDEX idx_co_purchases_product_b
    ON public.co_purchases (tenant_id, product_b);

-- 4. Permisos: SOLO pymepilot_app (H-01: authenticated NO tiene acceso)
GRANT SELECT ON public.co_purchases TO pymepilot_app;

-- 5. Recrear funcion refresh (referencia la MV que se dropeo)
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.co_purchases;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.co_purchases;
    END;

    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_rankings;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.client_rankings;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.refresh_materialized_views() TO pymepilot_app;

-- 6. Refresh inicial (poblar con datos filtrados)
REFRESH MATERIALIZED VIEW public.co_purchases;

-- 7. Notificar PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
