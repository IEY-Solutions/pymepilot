-- Migration 036: Tabla push_subscriptions para Web Push API
-- Fecha: 2026-03-06
-- Fase: 10 Bloque C — Notificaciones Push
--
-- QUE HACE:
-- Crea tabla para almacenar suscripciones de Web Push API.
-- Cada fila = un navegador que acepto recibir notificaciones.
-- pywebpush en backend las lee para enviar push post-orquestador.
--
-- SEGURIDAD:
-- RLS + FORCE RLS. Patron de migration 019.
-- authenticated: INSERT/SELECT/DELETE (el usuario gestiona sus suscripciones)
-- pymepilot_app: SELECT (el worker lee para enviar push)
--
-- Rollback: database/migrations/036_rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    user_id     UUID NOT NULL,
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_tenant
    ON public.push_subscriptions (tenant_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_tenant_isolation ON public.push_subscriptions;
CREATE POLICY push_subscriptions_tenant_isolation
    ON public.push_subscriptions
    FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS push_subscriptions_worker_access ON public.push_subscriptions;
CREATE POLICY push_subscriptions_worker_access
    ON public.push_subscriptions
    FOR SELECT TO pymepilot_app
    USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, DELETE ON public.push_subscriptions TO pymepilot_app;

NOTIFY pgrst, 'reload schema';

COMMIT;
