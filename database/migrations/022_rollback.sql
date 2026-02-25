-- Rollback migracion 022: Quitar CHECK constraint en notifications.type
-- EJECUTAR CONTRA: orion_db

BEGIN;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

COMMIT;
