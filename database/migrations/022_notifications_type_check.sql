-- =============================================================================
-- MIGRACION 022: CHECK constraint en notifications.type
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- Agrega una restriccion CHECK a notifications.type que solo permite
-- valores conocidos. Consistente con notifications.channel que ya tiene CHECK.
--
-- POR QUE:
-- Sin CHECK, cualquier string se puede insertar como tipo de notificacion.
-- Un typo en el codigo ("stale_dat" en vez de "stale_data") pasaria sin error.
-- Con CHECK, la DB rechaza valores invalidos — ultima linea de defensa.
--
-- CONCEPTO CLAVE - CHECK constraint:
-- Es una regla que la DB verifica en cada INSERT/UPDATE. Si el valor no
-- esta en la lista, la operacion falla con un error claro. Como un
-- candado que solo acepta ciertas llaves.
--
-- VALORES INCLUIDOS:
-- - stale_data: datos desactualizados (check_data_freshness.py)
-- - sync_completed / sync_failed: resultado de sync (futuro)
-- - upload_completed / upload_failed: resultado de upload (futuro)
-- =============================================================================

BEGIN;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('stale_data', 'sync_completed', 'sync_failed', 'upload_completed', 'upload_failed'));

COMMIT;
