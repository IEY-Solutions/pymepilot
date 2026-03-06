-- Rollback Migration 035: RPCs para /logros y Ventas Realizadas
-- Elimina las 3 funciones creadas en la migracion 035.

BEGIN;

DROP FUNCTION IF EXISTS public.get_achievements(date);
DROP FUNCTION IF EXISTS public.get_total_sales(int);
DROP FUNCTION IF EXISTS public.get_streak_days();

NOTIFY pgrst, 'reload schema';

COMMIT;
