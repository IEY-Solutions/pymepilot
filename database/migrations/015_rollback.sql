-- Rollback 015: Eliminar tabla api_usage
-- Seguro ejecutar: solo elimina la tabla de tracking de costos.
-- No afecta datos de negocio (customers, orders, predictions).

BEGIN;
DROP TABLE IF EXISTS api_usage;
COMMIT;
