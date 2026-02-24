-- Migracion 019: Tablas para notificaciones y Google Drive connections
-- Parte del plan de Ingesta Fase 2
-- Fecha: 2026-02-24
--
-- QUE CREA:
-- 1. tenant_notification_config: Configuracion de alertas por tenant
-- 2. notifications: Inbox de notificaciones del dashboard
-- 3. drive_connections: Conexiones a carpetas de Google Drive
--
-- SEGURIDAD: RLS + FORCE RLS en las 3 tablas.
-- Worker (pymepilot_app) tiene acceso cross-tenant para insertar notificaciones.

BEGIN;

-- 1. Configuracion de notificaciones por tenant
CREATE TABLE IF NOT EXISTS public.tenant_notification_config (
    tenant_id                   UUID PRIMARY KEY REFERENCES tenants(id),
    stale_data_threshold_hours  INTEGER NOT NULL DEFAULT 72,
    channels_enabled            JSONB NOT NULL DEFAULT '{"dashboard": true}',
    whatsapp_number             TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_notification_config FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_notification_config_isolation
    ON public.tenant_notification_config
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_notification_config_worker_access
    ON public.tenant_notification_config
    FOR ALL TO pymepilot_app
    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.tenant_notification_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_notification_config TO pymepilot_app;

-- 2. Notificaciones (inbox dashboard + log de canales)
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    channel     TEXT NOT NULL CHECK (channel IN ('dashboard', 'whatsapp')),
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT false,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_unread
    ON public.notifications (tenant_id, created_at DESC) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY notifications_tenant_isolation ON public.notifications
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY notifications_worker_access ON public.notifications
    FOR ALL TO pymepilot_app
    USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO pymepilot_app;

-- 3. Conexiones Google Drive
CREATE TABLE IF NOT EXISTS public.drive_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    folder_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'error')),
    last_synced_at  TIMESTAMPTZ,
    last_file_hash  TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY drive_connections_tenant_isolation ON public.drive_connections
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY drive_connections_worker_access ON public.drive_connections
    FOR ALL TO pymepilot_app
    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.drive_connections TO pymepilot_app;

COMMIT;
