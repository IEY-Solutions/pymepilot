-- Rollback Migration 024: Revert orchestrator infrastructure
--
-- CUANDO USAR: Si la migracion 024 causo problemas y hay que deshacerla.
-- ORDEN: Ejecutar ANTES de rollback de migraciones anteriores.

BEGIN;

-- 1. Revocar permisos
REVOKE ALL ON public.orchestrator_runs FROM pymepilot_app;
REVOKE ALL ON public.orchestrator_runs FROM authenticated;

-- 2. Eliminar tabla
DROP TABLE IF EXISTS public.orchestrator_runs;

-- 3. Eliminar columna de tenants
ALTER TABLE public.tenants DROP COLUMN IF EXISTS active_verticals;

-- 4. Notificar a PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
