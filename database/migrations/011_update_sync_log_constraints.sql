-- Migration 011: Update sync_log constraints + erp_config comment
-- Fecha: 2026-02-20
-- Descripcion: Prepara la DB para Fase 1 (Conectores ERP)
--
-- CAMBIOS:
-- 1. sync_log.status: agrega 'requires_review' (necesario para audit post-sync)
-- 2. sync_log.sync_type: agrega 'limited' (necesario para --limit N)
-- 3. erp_config comment: actualiza para reflejar que almacena credenciales ENCRIPTADAS
--
-- POR QUE:
-- Sin el cambio 1, cuando audit_logs_for_secrets() detecte un token filtrado,
-- el UPDATE a 'requires_review' fallaria con constraint violation y el hallazgo
-- se perderia silenciosamente. La segunda linea de defensa quedaria rota.
-- Sin el cambio 2, un sync con --limit 5 quedaria registrado como 'full',
-- lo que confundiria al ver customers_synced=5 pensando que IEY tiene 5 clientes.

-- 1. Ampliar CHECK de status
ALTER TABLE sync_log DROP CONSTRAINT valid_sync_status;
ALTER TABLE sync_log ADD CONSTRAINT valid_sync_status
    CHECK (status IN ('started', 'completed', 'failed', 'requires_review'));

-- 2. Ampliar CHECK de sync_type
ALTER TABLE sync_log DROP CONSTRAINT valid_sync_type;
ALTER TABLE sync_log ADD CONSTRAINT valid_sync_type
    CHECK (sync_type IN ('full', 'incremental', 'limited'));

-- 3. Actualizar comment de erp_config (no contradecir el plan)
COMMENT ON COLUMN tenants.erp_config IS
    'Configuracion del conector ERP. Credenciales se almacenan ENCRIPTADAS con Fernet '
    '(campo client_secret_encrypted = ciphertext). La clave de encriptacion esta en .env, NO en la DB. '
    'NUNCA almacenar secrets en texto plano.';
