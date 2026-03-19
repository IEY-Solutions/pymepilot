-- =============================================================================
-- Rollback 055: RPCs de Cuentas Clave — Drop funciones
-- =============================================================================
-- EJECUTAR CONTRA: orion_db

BEGIN;

DROP FUNCTION IF EXISTS public.suggest_key_accounts();
DROP FUNCTION IF EXISTS public.get_key_account_financial_summary(uuid);
DROP FUNCTION IF EXISTS public.get_key_account_health_score(uuid);

NOTIFY pgrst, 'reload schema';

COMMIT;
