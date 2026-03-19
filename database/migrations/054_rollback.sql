-- =============================================================================
-- Rollback 054: Cuentas Clave — Drop tablas
-- =============================================================================
-- EJECUTAR CONTRA: orion_db

BEGIN;

DROP TABLE IF EXISTS public.key_account_alerts CASCADE;
DROP TABLE IF EXISTS public.key_account_notes CASCADE;
DROP TABLE IF EXISTS public.key_accounts CASCADE;

NOTIFY pgrst, 'reload schema';

COMMIT;
