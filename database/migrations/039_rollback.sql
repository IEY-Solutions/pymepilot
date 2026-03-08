-- Rollback 039: Revertir 'rate_limit_event' del CHECK de sync_type
-- IMPORTANTE: Si ya existen filas con sync_type='rate_limit_event',
-- este rollback FALLARA. Primero borrar o actualizar esas filas:
--   UPDATE sync_log SET sync_type = 'full' WHERE sync_type = 'rate_limit_event';

ALTER TABLE sync_log DROP CONSTRAINT valid_sync_type;
ALTER TABLE sync_log ADD CONSTRAINT valid_sync_type
    CHECK (sync_type IN ('full', 'incremental', 'limited'));
