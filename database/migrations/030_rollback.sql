-- ============================================================
-- Rollback 030: Restaurar co_purchases SIN filtro de status
-- ============================================================
-- NOTA: Esto vuelve a la version original de 026 (sin filtro
-- status='completed'). Solo usar si el filtro causa problemas.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.co_purchases CASCADE;

-- Recrear version original (026) sin filtro de status
CREATE MATERIALIZED VIEW public.co_purchases AS
SELECT
    o.tenant_id,
    oi1.product_id AS product_a,
    pa.name AS product_a_name,
    oi2.product_id AS product_b,
    pb.name AS product_b_name,
    COUNT(DISTINCT o.id) AS times_bought_together,
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
    AND oi1.product_id < oi2.product_id
JOIN orders o ON oi1.order_id = o.id
JOIN products pa ON pa.id = oi1.product_id
JOIN products pb ON pb.id = oi2.product_id
GROUP BY o.tenant_id, oi1.product_id, pa.name, oi2.product_id, pb.name
HAVING COUNT(DISTINCT o.id) >= 3
WITH NO DATA;

CREATE UNIQUE INDEX idx_co_purchases_pk
    ON public.co_purchases (tenant_id, product_a, product_b);
CREATE INDEX idx_co_purchases_product_a
    ON public.co_purchases (tenant_id, product_a);
CREATE INDEX idx_co_purchases_product_b
    ON public.co_purchases (tenant_id, product_b);

GRANT SELECT ON public.co_purchases TO pymepilot_app;

-- Recrear funcion refresh
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

REFRESH MATERIALIZED VIEW public.co_purchases;
NOTIFY pgrst, 'reload schema';

COMMIT;
