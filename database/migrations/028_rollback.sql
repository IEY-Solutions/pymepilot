-- Rollback Migration 028: Revert client detail RPCs

BEGIN;

DROP FUNCTION IF EXISTS public.get_client_monthly_revenue(uuid, int);
DROP FUNCTION IF EXISTS public.get_client_trends(int);

NOTIFY pgrst, 'reload schema';

COMMIT;
