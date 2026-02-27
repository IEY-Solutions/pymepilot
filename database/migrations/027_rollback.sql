-- Rollback Migration 027: Revert KPI RPCs + client_rankings_secure view

BEGIN;

DROP FUNCTION IF EXISTS public.get_client_top_products(uuid, int);
DROP FUNCTION IF EXISTS public.get_monthly_value(int);
DROP FUNCTION IF EXISTS public.get_monthly_ticket(int);
DROP FUNCTION IF EXISTS public.get_monthly_churn(int);
DROP FUNCTION IF EXISTS public.get_monthly_revenue_split(int);
DROP VIEW IF EXISTS public.client_rankings_secure;

NOTIFY pgrst, 'reload schema';

COMMIT;
