-- Migration 039: Agregar 'rate_limit_event' al CHECK de sync_type
-- Fecha: 2026-03-08
-- Auditoria: R25-H-01
--
-- QUE HACE:
-- Agrega 'rate_limit_event' como valor valido para sync_log.sync_type.
--
-- POR QUE:
-- El Fix 12 del hotfix Contabilium (commit e3191d8) agrego
-- _handle_rate_limit_event() que inserta en sync_log con
-- sync_type='rate_limit_event'. Pero el CHECK constraint solo
-- permitia 'full', 'incremental', 'limited'. El INSERT fallaba
-- silenciosamente (capturado por except), asi que los eventos 429
-- NUNCA se registraban en la DB. Grafana no podia mostrarlos.
--
-- CONCEPTO - CHECK constraint:
-- Es una regla en la tabla que valida los valores permitidos.
-- Si intentas insertar un valor no listado, PostgreSQL rechaza
-- la fila con un error. Aqui ampliamos la lista de valores
-- permitidos para incluir el nuevo tipo.

-- Ampliar CHECK de sync_type
ALTER TABLE sync_log DROP CONSTRAINT valid_sync_type;
ALTER TABLE sync_log ADD CONSTRAINT valid_sync_type
    CHECK (sync_type IN ('full', 'incremental', 'limited', 'rate_limit_event'));

-- GRANTs: no necesarios. pymepilot_app ya tiene INSERT/UPDATE en sync_log
-- (otorgado en migration 012). Los CHECK constraints se evaluan
-- automaticamente, no requieren permisos adicionales.
