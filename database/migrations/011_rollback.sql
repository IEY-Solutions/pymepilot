-- Rollback 011: Revert sync_log constraints + erp_config comment
-- Fecha: 2026-02-20
--
-- IMPORTANTE: Si hay registros con status='requires_review' o sync_type='limited',
-- este rollback los actualiza antes de restaurar los constraints originales.

-- 1. Revertir registros con valores nuevos (si existen)
UPDATE sync_log SET status = 'failed' WHERE status = 'requires_review';
UPDATE sync_log SET sync_type = 'full' WHERE sync_type = 'limited';

-- 2. Restaurar CHECK de status original
ALTER TABLE sync_log DROP CONSTRAINT valid_sync_status;
ALTER TABLE sync_log ADD CONSTRAINT valid_sync_status
    CHECK (status IN ('started', 'completed', 'failed'));

-- 3. Restaurar CHECK de sync_type original
ALTER TABLE sync_log DROP CONSTRAINT valid_sync_type;
ALTER TABLE sync_log ADD CONSTRAINT valid_sync_type
    CHECK (sync_type IN ('full', 'incremental'));

-- 4. Restaurar comment original de erp_config
COMMENT ON COLUMN tenants.erp_config IS
    'Configuracion del conector ERP (endpoint, mapping). NUNCA almacenar secrets aqui';
