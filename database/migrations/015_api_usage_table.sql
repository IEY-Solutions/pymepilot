-- Migracion 015: Tabla api_usage para control de costos de Claude API
-- Fecha: 2026-02-22
-- Que hace: Crea tabla GLOBAL (no tiene tenant_id, no tiene RLS)
--   para registrar cada llamada a la API de Claude y controlar costos.
-- Por que: 4 capas de control de costos. Sin esta tabla no hay
--   limite diario, ni tracking, ni alertas.
-- Cada fila = 1 llamada a Claude. Se agrega por dia para sumar
--   el consumo total y comparar contra DAILY_TOKEN_LIMIT.

BEGIN;

CREATE TABLE api_usage (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usage_date  date NOT NULL DEFAULT CURRENT_DATE,
    tokens_input  integer NOT NULL DEFAULT 0,
    tokens_output integer NOT NULL DEFAULT 0,
    tokens_total  integer NOT NULL DEFAULT 0,
    cost_usd    numeric(10,6) NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- Columna se llama usage_date (no "date") porque "date" es palabra
-- reservada en PostgreSQL. Buena practica: evitar nombres reservados.

COMMENT ON TABLE api_usage IS
  'Registro de cada llamada a Claude API. Tabla GLOBAL (sin RLS). Cada fila = 1 llamada.';

-- Indice para la query mas frecuente: SUM tokens del dia actual
CREATE INDEX idx_api_usage_date ON api_usage (usage_date);

-- Permisos para pymepilot_app (solo INSERT + SELECT, no UPDATE ni DELETE)
-- No puede modificar ni borrar registros historicos de consumo.
GRANT SELECT, INSERT ON api_usage TO pymepilot_app;

-- Revocar UPDATE explicitamente por si hay default privileges activos
-- que otorguen mas permisos de los necesarios.
REVOKE UPDATE, DELETE ON api_usage FROM pymepilot_app;

COMMIT;
