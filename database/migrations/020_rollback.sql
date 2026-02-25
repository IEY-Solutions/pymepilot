-- Rollback migracion 020: Revertir FK CASCADE y user_id nullable
-- NOTA: Revertir user_id a NOT NULL solo funciona si no hay filas con NULL.
-- Si hay upload_jobs de Drive sync (user_id=NULL), el rollback falla.

BEGIN;

-- 1. Revertir FK CASCADE → NO ACTION (default)
ALTER TABLE public.upload_jobs
    DROP CONSTRAINT upload_jobs_tenant_id_fkey,
    ADD CONSTRAINT upload_jobs_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public.notifications
    DROP CONSTRAINT notifications_tenant_id_fkey,
    ADD CONSTRAINT notifications_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public.tenant_notification_config
    DROP CONSTRAINT tenant_notification_config_tenant_id_fkey,
    ADD CONSTRAINT tenant_notification_config_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE public.drive_connections
    DROP CONSTRAINT drive_connections_tenant_id_fkey,
    ADD CONSTRAINT drive_connections_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- 2. Revertir user_id a NOT NULL
-- ADVERTENCIA: Falla si existen filas con user_id=NULL
ALTER TABLE public.upload_jobs ALTER COLUMN user_id SET NOT NULL;

COMMIT;
