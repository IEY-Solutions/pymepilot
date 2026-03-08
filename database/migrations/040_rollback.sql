-- =============================================================================
-- ROLLBACK 040: Eliminar tabla chat_usage
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS chat_usage_tenant_isolation ON public.chat_usage;
DROP TABLE IF EXISTS public.chat_usage;

COMMIT;
