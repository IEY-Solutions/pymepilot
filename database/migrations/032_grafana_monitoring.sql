-- =============================================================================
-- MIGRACION 032: Setup de monitoreo Grafana (usuario + VIEWs)
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- 1. Crea role grafana_reader (LOGIN, sin password — se setea por separado)
-- 2. Otorga CONNECT y USAGE minimos
-- 3. Crea 4 VIEWs de monitoreo con metricas agregadas
-- 4. Otorga SELECT solo sobre las 4 VIEWs
--
-- POR QUE:
-- Grafana necesita leer metricas operativas (ejecuciones, costos, syncs,
-- predicciones) para mostrar dashboards de monitoreo. Pero NO debe tener
-- acceso a datos de clientes, credenciales, ni mensajes individuales.
-- Las VIEWs actuan como filtro: solo exponen conteos, sumas, y estados.
--
-- CONCEPTO - PRINCIPIO DE MINIMO PRIVILEGIO:
-- grafana_reader solo puede hacer SELECT sobre 4 VIEWs especificas.
-- No tiene acceso a ninguna tabla directamente. Si alguien roba las
-- credenciales de Grafana, lo unico que puede ver son metricas agregadas.
--
-- CONCEPTO - VIEW como capa de seguridad:
-- Las VIEWs corren con permisos del OWNER (postgres, superuser), asi
-- que pueden leer tablas con RLS (sync_log, predictions). Pero la VIEW
-- filtra las columnas sensibles (tenant_id, customer_id, message_text).
-- grafana_reader solo ve el resultado filtrado, nunca la tabla real.
--
-- NOTA SOBRE PASSWORD:
-- El role se crea SIN password. Se debe ejecutar ALTER ROLE por separado
-- para setear la password. Hasta que se setee, nadie puede loguearse.
-- Esto evita que un secret quede en archivos commiteados a git.
-- =============================================================================

BEGIN;

-- =============================================
-- 1. CREAR ROLE grafana_reader
-- =============================================
-- LOGIN: puede conectarse a la DB (necesario para Grafana)
-- NOSUPERUSER/NOCREATEDB/NOCREATEROLE: sin privilegios administrativos
-- Sin PASSWORD: se setea por separado (seguridad)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader') THEN
        CREATE ROLE grafana_reader WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
        RAISE NOTICE 'Role grafana_reader creado';
    ELSE
        RAISE NOTICE 'Role grafana_reader ya existe, saltando creacion';
    END IF;
END
$$;

-- =============================================
-- 2. PERMISOS MINIMOS
-- =============================================
-- CONNECT: puede conectarse a la DB orion_db
-- USAGE: puede ver que el schema public existe (pero no sus tablas)
GRANT CONNECT ON DATABASE orion_db TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;

-- =============================================
-- 3. VIEWs DE MONITOREO
-- =============================================

-- VIEW 1: monitoring_operations
-- Fuente: orchestrator_runs (sin RLS, tabla global)
-- Muestra: fecha, estado, conteos, duracion, cantidad de errores
-- NO muestra: contenido de errores (jsonb con posibles datos sensibles)
-- IMPORTANTE: usar public. explicito porque en orion_db el search_path
-- es auth,public — sin el prefijo, las VIEWs se crean en schema auth.
DROP VIEW IF EXISTS public.monitoring_operations;
CREATE VIEW public.monitoring_operations AS
SELECT
    started_at::date AS run_date,
    started_at,
    completed_at,
    status,
    tenants_processed,
    predictions_generated,
    jsonb_array_length(errors) AS error_count,
    EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_seconds
FROM public.orchestrator_runs;

-- VIEW 2: monitoring_costs
-- Fuente: api_usage (sin RLS, tabla global)
-- Muestra: fecha, conteo de llamadas, tokens, costo USD (agregados por dia)
-- NO muestra: nada sensible (api_usage no tiene datos de clientes)
DROP VIEW IF EXISTS public.monitoring_costs;
CREATE VIEW public.monitoring_costs AS
SELECT
    usage_date,
    COUNT(*) AS api_calls,
    SUM(tokens_input) AS tokens_in,
    SUM(tokens_output) AS tokens_out,
    SUM(tokens_total) AS tokens_total,
    SUM(cost_usd) AS cost_usd
FROM public.api_usage
GROUP BY usage_date;

-- VIEW 3: monitoring_syncs
-- Fuente: sync_log (con RLS + FORCE RLS, pero la VIEW corre como postgres)
-- Muestra: fecha, tipo, source, estado, conteos, duracion
-- NO muestra: tenant_id, error_message, error_details (pueden tener datos sensibles)
DROP VIEW IF EXISTS public.monitoring_syncs;
CREATE VIEW public.monitoring_syncs AS
SELECT
    started_at::date AS sync_date,
    started_at,
    completed_at,
    sync_type,
    source,
    status,
    customers_synced,
    products_synced,
    orders_synced,
    EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_seconds
FROM public.sync_log;

-- VIEW 4: monitoring_predictions
-- Fuente: predictions (con RLS + FORCE RLS, pero la VIEW corre como postgres)
-- Muestra: fecha, vertical, estado, conteo, promedio de confianza (AGREGADOS)
-- NO muestra: tenant_id, customer_id, message_text, suggested_products, metadata
-- NOTA: Al agrupar por fecha+vertical+status, es imposible identificar clientes individuales
DROP VIEW IF EXISTS public.monitoring_predictions;
CREATE VIEW public.monitoring_predictions AS
SELECT
    prediction_date,
    vertical,
    status,
    COUNT(*) AS prediction_count,
    AVG(confidence_score)::numeric(3,2) AS avg_confidence
FROM public.predictions
GROUP BY prediction_date, vertical, status;

-- =============================================
-- 4. GRANT SELECT SOLO sobre las VIEWs
-- =============================================
-- grafana_reader NO tiene SELECT sobre ninguna tabla.
-- Solo puede leer estas 4 VIEWs.
GRANT SELECT ON public.monitoring_operations TO grafana_reader;
GRANT SELECT ON public.monitoring_costs TO grafana_reader;
GRANT SELECT ON public.monitoring_syncs TO grafana_reader;
GRANT SELECT ON public.monitoring_predictions TO grafana_reader;

-- =============================================
-- 5. NOTIFICAR PostgREST para recargar schema
-- =============================================
-- PostgREST cachea el schema. Sin esto, no veria las nuevas VIEWs.
-- (Las VIEWs no necesitan estar en PostgREST para Grafana, pero
-- el NOTIFY es buena practica despues de cualquier DDL.)
NOTIFY pgrst, 'reload schema';

COMMIT;
