-- Migracion 014: Campos para V2 Reposicion Predictiva
-- Fecha: 2026-02-22
-- Que hace:
--   1. Agrega stddev_days_between_purchases a customers (desviacion estandar
--      de los intervalos entre compras — mide que tan regular es el cliente)
--   2. Crea indice UNIQUE en predictions para evitar predicciones duplicadas
--      del mismo cliente + vertical + fecha (protege contra re-runs accidentales)
-- Por que: El motor V2 necesita stddev para calcular la confianza de cada
--   prediccion. Y el indice de dedup es una red de seguridad a nivel DB
--   para que el motor sea idempotente (correrlo 2 veces = mismo resultado).

BEGIN;

-- 1. Columna stddev en customers
-- Mismo tipo que avg_days_between_purchases (numeric 8,2) para consistencia.
-- NULL significa "no hay suficientes datos para calcular" (necesita min 3 ordenes
-- para tener 2 intervalos y calcular stddev).
ALTER TABLE customers
  ADD COLUMN stddev_days_between_purchases numeric(8,2);

-- Comentario para documentar en el schema
COMMENT ON COLUMN customers.stddev_days_between_purchases IS
  'Desviacion estandar de los intervalos entre compras (dias). NULL si < 3 ordenes.';

-- 2. Indice UNIQUE para deduplicacion de predictions
-- Evita que el motor genere 2 predicciones para el mismo cliente + vertical
-- en la misma fecha. Solo aplica a predicciones activas (pending/contacted),
-- porque un cliente puede tener predicciones completadas/expiradas anteriores.
CREATE UNIQUE INDEX idx_predictions_dedup
  ON predictions (tenant_id, customer_id, vertical, prediction_date)
  WHERE status IN ('pending', 'contacted');

-- 3. Permisos: pymepilot_app ya tiene SELECT, INSERT, UPDATE en customers
--    y predictions (migrations 005/006). No se necesitan permisos nuevos
--    porque solo agregamos una columna y un indice.

COMMIT;
