-- Rollback Migration 026: Revert Cross-Sell + KPIs infrastructure
--
-- CUANDO USAR: Si la migracion 026 causo problemas y hay que deshacerla.
-- ORDEN: Ejecutar ANTES de rollback de migraciones anteriores.

BEGIN;

-- 1. Revocar permisos de funcion
REVOKE EXECUTE ON FUNCTION public.refresh_materialized_views() FROM pymepilot_app;

-- 2. Eliminar funcion
DROP FUNCTION IF EXISTS public.refresh_materialized_views();

-- 3. Revocar permisos de vistas
REVOKE ALL ON public.co_purchases FROM pymepilot_app;
REVOKE ALL ON public.co_purchases FROM authenticated;
REVOKE ALL ON public.client_rankings FROM pymepilot_app;
REVOKE ALL ON public.client_rankings FROM authenticated;

-- 4. Eliminar indices (se eliminan automaticamente con DROP MV,
--    pero los listamos por claridad)
DROP INDEX IF EXISTS idx_co_purchases_product_b;
DROP INDEX IF EXISTS idx_co_purchases_product_a;
DROP INDEX IF EXISTS idx_co_purchases_pk;
DROP INDEX IF EXISTS idx_client_rankings_pk;
DROP INDEX IF EXISTS idx_orders_monthly_kpis;

-- 5. Eliminar vistas materializadas
DROP MATERIALIZED VIEW IF EXISTS public.client_rankings;
DROP MATERIALIZED VIEW IF EXISTS public.co_purchases;

-- 6. Notificar a PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
