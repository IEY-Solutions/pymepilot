-- Rollback Migration 036: Tabla push_subscriptions
BEGIN;

DROP TABLE IF EXISTS public.push_subscriptions;

NOTIFY pgrst, 'reload schema';

COMMIT;
