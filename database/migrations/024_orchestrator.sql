-- Migration 024: Orchestrator runs table + active_verticals column
--
-- QUE HACE: Crea la infraestructura para el orquestador diario (Fase 4).
-- 1. Tabla orchestrator_runs: registra cada ejecucion del orquestador
-- 2. Columna active_verticals en tenants: lista de verticales activas por tenant
--
-- POR QUE:
-- - orchestrator_runs permite monitorear si el sistema corrio, cuanto tardo,
--   y si hubo errores. Si el orquestador se cuelga, la fila queda en 'running'
--   y eso sirve para diagnosticar.
-- - active_verticals evita hardcodear que verticales correr. Se configura por
--   tenant y el orquestador lee la config en cada corrida.
--
-- SEGURIDAD:
-- - orchestrator_runs es GLOBAL (sin tenant_id, sin RLS), igual que api_usage.
-- - pymepilot_app: INSERT + SELECT + UPDATE (crea registro, lo actualiza al final)
-- - authenticated: solo SELECT (dashboard lee via PostgREST)
-- - Nadie tiene DELETE (las corridas son inmutables)
-- - UPDATE limitado a columnas especificas (no se puede cambiar started_at ni id)
--
-- Rollback: database/migrations/024_orchestrator_rollback.sql

BEGIN;

-- ============================================================
-- 1. Tabla orchestrator_runs
-- ============================================================

CREATE TABLE public.orchestrator_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'partial', 'failed', 'limit_exceeded')),
    tenants_processed INTEGER NOT NULL DEFAULT 0,
    predictions_generated INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice para consultar la ultima corrida rapidamente (dashboard)
CREATE INDEX idx_orchestrator_runs_latest
    ON public.orchestrator_runs (started_at DESC);

-- Permisos: pymepilot_app puede INSERT, SELECT, y UPDATE (columnas limitadas)
GRANT INSERT, SELECT ON public.orchestrator_runs TO pymepilot_app;
GRANT UPDATE (completed_at, status, tenants_processed, predictions_generated, errors)
    ON public.orchestrator_runs TO pymepilot_app;

-- Permisos: authenticated solo lee (para el dashboard via PostgREST)
GRANT SELECT ON public.orchestrator_runs TO authenticated;

-- ============================================================
-- 2. Columna active_verticals en tenants
-- ============================================================

ALTER TABLE public.tenants
    ADD COLUMN active_verticals JSONB NOT NULL DEFAULT '["reposicion"]'::jsonb;

-- ============================================================
-- 3. Notificar a PostgREST del cambio de schema
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
