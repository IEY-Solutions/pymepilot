-- Rollback 014: Revertir campos de V2 Reposicion
-- Seguro ejecutar: solo elimina columna e indice agregados en 014.
-- No afecta datos existentes en customers ni predictions.

BEGIN;

-- Quitar indice de dedup
DROP INDEX IF EXISTS idx_predictions_dedup;

-- Quitar columna stddev
ALTER TABLE customers
  DROP COLUMN IF EXISTS stddev_days_between_purchases;

COMMIT;
