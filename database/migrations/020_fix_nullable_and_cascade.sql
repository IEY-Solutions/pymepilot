-- =============================================================================
-- MIGRACION 020: Formalizar cambios manuales + corregir FK inconsistentes
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- 1. Formaliza user_id nullable en upload_jobs (cambio manual del 2026-02-25)
-- 2. Cambia FK de NO ACTION a ON DELETE CASCADE en 4 tablas
--
-- POR QUE:
-- 1. user_id: El Canal 3 (Drive sync) crea upload_jobs automaticamente
--    sin usuario humano. Con NOT NULL, el INSERT fallaba.
--    Este cambio se hizo manualmente en la DB pero no estaba en migraciones,
--    lo que rompia la reproducibilidad (si se recreaba la DB desde cero,
--    el Drive sync fallaria).
--
-- 2. FK CASCADE: Las 7 tablas originales (customers, products, orders, etc.)
--    usan ON DELETE CASCADE en su FK a tenants. Las 4 tablas nuevas
--    (upload_jobs, notifications, tenant_notification_config, drive_connections)
--    usaban ON DELETE NO ACTION (default de PostgreSQL). Esto significaba que
--    intentar borrar un tenant con datos asociados tiraba error FK violation
--    en vez de cascadear la eliminacion. Inconsistente y problematico para
--    cleanup de tenants de prueba.
--
-- CONCEPTO CLAVE - Drift de migraciones:
-- Cuando se hacen cambios manuales en la DB sin crear una migracion, se
-- produce "drift" — la DB real diverge de lo que dicen los archivos de
-- migracion. Si alguien recrea la DB desde cero (nuevo servidor, restore,
-- testing), obtiene una version diferente a la de produccion. Esta migracion
-- cierra ese drift.
-- =============================================================================

BEGIN;

-- 1. upload_jobs.user_id: nullable para jobs automaticos (Drive sync)
-- NOTA: ALTER COLUMN ... DROP NOT NULL es idempotente — si ya es nullable, no falla.
ALTER TABLE public.upload_jobs ALTER COLUMN user_id DROP NOT NULL;

-- 2. FK a ON DELETE CASCADE en las 4 tablas que no lo tenian
-- Patron: DROP la FK vieja → ADD la misma FK con ON DELETE CASCADE

-- upload_jobs
ALTER TABLE public.upload_jobs
    DROP CONSTRAINT upload_jobs_tenant_id_fkey,
    ADD CONSTRAINT upload_jobs_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE public.notifications
    DROP CONSTRAINT notifications_tenant_id_fkey,
    ADD CONSTRAINT notifications_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- tenant_notification_config
ALTER TABLE public.tenant_notification_config
    DROP CONSTRAINT tenant_notification_config_tenant_id_fkey,
    ADD CONSTRAINT tenant_notification_config_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- drive_connections
ALTER TABLE public.drive_connections
    DROP CONSTRAINT drive_connections_tenant_id_fkey,
    ADD CONSTRAINT drive_connections_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

COMMIT;
