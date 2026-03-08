-- =============================================================================
-- Migracion 040: Tabla chat_usage para limite diario del chatbot IA
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace: Crea tabla para registrar cada pregunta al chatbot por tenant.
--   Permite contar preguntas/dia y aplicar CHAT_DAILY_LIMIT (default 20).
-- Por que: Control de costos. Cada pregunta = 1 llamada a Claude Sonnet.
--   Sin esta tabla no hay limite por tenant.
-- Patron: Misma estructura que api_usage pero CON tenant_id y RLS.
-- =============================================================================

BEGIN;

-- 1. Tabla chat_usage: 1 fila por pregunta al chatbot
CREATE TABLE public.chat_usage (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id),
    usage_date  date NOT NULL DEFAULT CURRENT_DATE,
    question    text NOT NULL DEFAULT '',
    tokens_input  integer NOT NULL DEFAULT 0,
    tokens_output integer NOT NULL DEFAULT 0,
    tokens_total  integer NOT NULL DEFAULT 0,
    cost_usd    numeric(10,6) NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chat_usage IS
  'Registro de cada pregunta al chatbot IA. 1 fila = 1 pregunta. Tiene RLS por tenant.';

-- 2. Indices
-- Indice principal: contar preguntas del dia por tenant (query mas frecuente)
CREATE INDEX idx_chat_usage_tenant_date
    ON public.chat_usage (tenant_id, usage_date);

-- 3. RLS
ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_usage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_usage_tenant_isolation ON public.chat_usage;
CREATE POLICY chat_usage_tenant_isolation
    ON public.chat_usage
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- 4. Permisos para authenticated (dashboard via PostgREST)
GRANT SELECT, INSERT ON public.chat_usage TO authenticated;
REVOKE UPDATE, DELETE ON public.chat_usage FROM authenticated;

-- 5. Permisos para pymepilot_app (motor Python, por si se necesita)
GRANT SELECT, INSERT ON public.chat_usage TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.chat_usage FROM pymepilot_app;

COMMIT;
