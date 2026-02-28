-- ============================================================
-- Rollback 029: Restaurar SELECT en co_purchases para authenticated
-- ============================================================
-- NOTA: Esto RE-EXPONE la MV sin RLS al frontend.
-- Solo usar si hay una razon valida para que authenticated lea
-- co_purchases directamente (ej: nueva feature que lo requiera).
-- ============================================================

BEGIN;

GRANT SELECT ON public.co_purchases TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
