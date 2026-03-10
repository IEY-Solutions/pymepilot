-- Rollback 046: Revertir branding por tenant
-- ============================================================

-- 1. Quitar policies
DROP POLICY IF EXISTS tenant_select ON public.tenants;
DROP POLICY IF EXISTS tenant_update ON public.tenants;

-- 2. Deshabilitar RLS (volver al estado anterior)
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;

-- 3. Quitar columna
ALTER TABLE public.tenants DROP COLUMN IF EXISTS branding_config;

NOTIFY pgrst, 'reload schema';
