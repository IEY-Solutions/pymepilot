-- ============================================================
-- Migracion 046: Branding por tenant (logo + color primario)
-- ============================================================
-- QUE HACE: Agrega configuracion de marca visual por tenant.
-- Cada tenant puede tener su logo y color primario.
--
-- CONCEPTO: JSONB permite guardar datos flexibles sin necesidad
-- de crear una columna por cada campo. Si en el futuro queremos
-- agregar mas opciones (fuente, moneda, idioma), no hace falta
-- otra migracion — se agrega al JSON.
--
-- El logo se guarda como base64 en el mismo JSONB (tipicamente
-- <100KB). Esto evita la complejidad de un bucket de storage
-- separado con sus propias policies de RLS.
-- ============================================================

-- 1. Agregar columna branding_config a tenants
-- (ya aplicada — IF NOT EXISTS protege contra re-ejecucion)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS branding_config JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tenants.branding_config IS
'Configuracion de marca visual del tenant. Estructura: {"logo_base64": "data:image/png;base64,...", "primary_color": "#3B82F6"}';

-- 2. RLS en tenants (no tenia — cada tenant solo puede ver/editar su propio registro)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- SELECT: sin context ve todos (orquestador), con context ve solo el suyo (frontend)
CREATE POLICY tenant_select ON public.tenants
FOR SELECT USING (
    coalesce(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
        current_setting('app.tenant_id', true)
    ) IS NULL
    OR
    id::text = coalesce(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
        current_setting('app.tenant_id', true)
    )
);

CREATE POLICY tenant_update ON public.tenants
FOR UPDATE USING (
    id::text = coalesce(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
        current_setting('app.tenant_id', true)
    )
);

-- 3. Notificar a PostgREST que el schema cambio
NOTIFY pgrst, 'reload schema';
