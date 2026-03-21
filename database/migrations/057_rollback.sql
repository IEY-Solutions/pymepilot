-- Rollback 057: Revertir arquitectura multi-módulo
--
-- Elimina las columnas segment y active_modules de tenants.
-- Usar solo si hay que revertir la migración 057.

BEGIN;

ALTER TABLE public.tenants
DROP CONSTRAINT IF EXISTS tenants_segment_check;

ALTER TABLE public.tenants
DROP CONSTRAINT IF EXISTS tenants_active_modules_not_empty;

ALTER TABLE public.tenants
DROP COLUMN IF EXISTS segment;

ALTER TABLE public.tenants
DROP COLUMN IF EXISTS active_modules;

NOTIFY pgrst, 'reload schema';

COMMIT;
