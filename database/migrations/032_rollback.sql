-- =============================================================================
-- ROLLBACK 032: Revertir setup de monitoreo Grafana
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- 1. Revoca permisos de grafana_reader
-- 2. Elimina las 4 VIEWs de monitoreo
-- 3. Elimina el role grafana_reader
-- =============================================================================

BEGIN;

-- Revocar permisos sobre VIEWs (si existen)
REVOKE ALL ON public.monitoring_operations FROM grafana_reader;
REVOKE ALL ON public.monitoring_costs FROM grafana_reader;
REVOKE ALL ON public.monitoring_syncs FROM grafana_reader;
REVOKE ALL ON public.monitoring_predictions FROM grafana_reader;

-- Revocar permisos de schema y DB
REVOKE USAGE ON SCHEMA public FROM grafana_reader;
REVOKE CONNECT ON DATABASE orion_db FROM grafana_reader;

-- Eliminar VIEWs
DROP VIEW IF EXISTS public.monitoring_operations;
DROP VIEW IF EXISTS public.monitoring_costs;
DROP VIEW IF EXISTS public.monitoring_syncs;
DROP VIEW IF EXISTS public.monitoring_predictions;

-- Eliminar role
DROP ROLE IF EXISTS grafana_reader;

NOTIFY pgrst, 'reload schema';

COMMIT;
