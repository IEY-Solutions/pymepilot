-- ============================================================
-- Migration 029: Revocar SELECT en co_purchases para authenticated
-- ============================================================
-- FIX H-01 (Auditoria Fase 7): La MV co_purchases no tiene RLS
-- (PostgreSQL no soporta RLS en Materialized Views). El GRANT SELECT
-- a authenticated (migration 026) permite que cualquier usuario
-- consulte co-compras de TODOS los tenants via PostgREST.
--
-- El frontend NO necesita co_purchases directamente — V3 Cross-Sell
-- corre en Python via pymepilot_app (que mantiene su GRANT).
--
-- Patron: igual que client_rankings (MV sin RLS), pero esa tiene
-- client_rankings_secure (VIEW con filtro tenant). co_purchases no
-- necesita VIEW porque no se consume desde el frontend.
-- ============================================================

BEGIN;

-- Revocar acceso directo del frontend a la MV sin RLS
REVOKE SELECT ON public.co_purchases FROM authenticated;

-- Notificar a PostgREST para que recargue el schema
-- (asi deja de exponer co_purchases en la API REST)
NOTIFY pgrst, 'reload schema';

COMMIT;
