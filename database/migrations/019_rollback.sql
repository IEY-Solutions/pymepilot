-- Rollback migracion 019: Eliminar tablas de notificaciones y Drive
-- OPERACION DE ALTO RIESGO: Borra datos de notificaciones y conexiones Drive
-- Ejecutar solo si se necesita revertir la migracion 019

BEGIN;

DROP TABLE IF EXISTS public.drive_connections CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.tenant_notification_config CASCADE;

COMMIT;
