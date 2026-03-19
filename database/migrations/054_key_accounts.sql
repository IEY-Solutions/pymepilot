-- =============================================================================
-- Migracion 054: Cuentas Clave — Key Account Management
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace: Crea 3 tablas para gestion de cuentas clave (clientes estrategicos):
--   1. key_accounts: marca un customer como cuenta clave con semaforo de salud
--   2. key_account_notes: notas de interaccion (reuniones, llamadas, promesas)
--   3. key_account_alerts: alertas y acciones pendientes (temporales, comportamiento, manuales)
-- Por que: El operador necesita un seguimiento relacional (no solo operativo)
--   de sus clientes mas importantes. Diferente al Pipeline CRM que es transaccional.
-- Patron: Misma estructura RLS que el resto del proyecto (tenant_id + FORCE).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABLA key_accounts: marca un customer como cuenta clave
-- =============================================================================
-- Concepto: Un subconjunto de clientes que el operador considera estrategicos.
-- Cada cuenta tiene un semaforo de salud (green/yellow/red) que se calcula
-- automaticamente o se puede forzar manualmente.

CREATE TABLE public.key_accounts (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id             uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

    -- Estado
    status                  text NOT NULL DEFAULT 'active',
    health_score            text NOT NULL DEFAULT 'green',
    health_override         text,
    source                  text NOT NULL DEFAULT 'manual',

    -- Contadores (denormalizados para la tarjeta)
    notes_count             integer NOT NULL DEFAULT 0,
    pending_actions_count   integer NOT NULL DEFAULT 0,

    -- Timestamps
    created_at              timestamptz NOT NULL DEFAULT NOW(),
    created_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Validaciones
    CONSTRAINT valid_ka_status CHECK (status IN ('active', 'archived')),
    CONSTRAINT valid_ka_health CHECK (health_score IN ('green', 'yellow', 'red')),
    CONSTRAINT valid_ka_health_override CHECK (
        health_override IS NULL OR health_override IN ('green', 'yellow', 'red')
    ),
    CONSTRAINT valid_ka_source CHECK (source IN ('manual', 'suggested')),

    -- Un cliente solo puede ser cuenta clave una vez por tenant
    CONSTRAINT uq_key_accounts_tenant_customer UNIQUE (tenant_id, customer_id)
);

COMMENT ON TABLE public.key_accounts IS
  'Cuentas clave (Key Accounts). Clientes estrategicos con seguimiento relacional. RLS por tenant.';

-- Indice principal: cuentas activas del tenant (query de la grilla)
CREATE INDEX idx_key_accounts_tenant_status
    ON public.key_accounts (tenant_id, status);

-- Indice para filtrar por salud (solo activas)
CREATE INDEX idx_key_accounts_tenant_health
    ON public.key_accounts (tenant_id, health_score)
    WHERE status = 'active';

-- RLS
ALTER TABLE public.key_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS key_accounts_tenant_isolation ON public.key_accounts;
CREATE POLICY key_accounts_tenant_isolation
    ON public.key_accounts
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Permisos: authenticated necesita SELECT, INSERT, UPDATE (cambiar status, health)
GRANT SELECT, INSERT, UPDATE ON public.key_accounts TO authenticated;
REVOKE DELETE ON public.key_accounts FROM authenticated;

-- pymepilot_app: SELECT, INSERT (para sugerencias automaticas si se necesita)
GRANT SELECT, INSERT ON public.key_accounts TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.key_accounts FROM pymepilot_app;


-- =============================================================================
-- 2. TABLA key_account_notes: notas de interaccion (append-only)
-- =============================================================================
-- Concepto: Cada vez que el operador interactua con una cuenta clave
-- (reunion, llamada, promesa del cliente, observacion), registra una nota.
-- Es append-only: nunca se edita ni se borra.

CREATE TABLE public.key_account_notes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_account_id      uuid NOT NULL REFERENCES public.key_accounts(id) ON DELETE CASCADE,

    -- Contenido
    note_type           text NOT NULL,
    content             text NOT NULL,

    -- Autor
    created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Timestamp
    created_at          timestamptz NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_kan_type CHECK (
        note_type IN ('meeting', 'call', 'promise', 'observation')
    )
);

COMMENT ON TABLE public.key_account_notes IS
  'Notas de interaccion con cuentas clave. Append-only (sin UPDATE/DELETE). RLS por tenant.';

-- Indice principal: notas de una cuenta ordenadas por fecha
CREATE INDEX idx_key_account_notes_account_date
    ON public.key_account_notes (key_account_id, created_at DESC);

-- RLS
ALTER TABLE public.key_account_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_account_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS key_account_notes_tenant_isolation ON public.key_account_notes;
CREATE POLICY key_account_notes_tenant_isolation
    ON public.key_account_notes
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Permisos: append-only (SELECT + INSERT, sin UPDATE ni DELETE)
GRANT SELECT, INSERT ON public.key_account_notes TO authenticated;
REVOKE UPDATE, DELETE ON public.key_account_notes FROM authenticated;

-- pymepilot_app: SELECT, INSERT
GRANT SELECT, INSERT ON public.key_account_notes TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.key_account_notes FROM pymepilot_app;


-- =============================================================================
-- 3. TABLA key_account_alerts: alertas y acciones pendientes
-- =============================================================================
-- Concepto: 3 tipos de alertas:
--   - temporal: "hace X dias que no interactuas con este cliente"
--   - behavioral: "bajo X% su facturacion"
--   - manual: creadas desde notas (action items) o desde boton "Nueva alarma"
-- Las acciones pendientes son alertas manuales con source_note_id.

CREATE TABLE public.key_account_alerts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_account_id      uuid NOT NULL REFERENCES public.key_accounts(id) ON DELETE CASCADE,

    -- Contenido
    alert_type          text NOT NULL,
    title               text NOT NULL,
    description         text,
    trigger_rule        text,
    trigger_date        timestamptz,

    -- Estado
    status              text NOT NULL DEFAULT 'pending',

    -- Origen (si fue creada desde una nota)
    source_note_id      uuid REFERENCES public.key_account_notes(id) ON DELETE SET NULL,

    -- Timestamps
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    resolved_at         timestamptz,

    -- Validaciones
    CONSTRAINT valid_kaa_type CHECK (
        alert_type IN ('temporal', 'behavioral', 'manual')
    ),
    CONSTRAINT valid_kaa_status CHECK (
        status IN ('pending', 'triggered', 'dismissed', 'resolved')
    )
);

COMMENT ON TABLE public.key_account_alerts IS
  'Alertas y acciones pendientes de cuentas clave. 3 tipos: temporal, behavioral, manual. RLS por tenant.';

-- Indice: alertas de una cuenta por estado
CREATE INDEX idx_key_account_alerts_account_status
    ON public.key_account_alerts (key_account_id, status);

-- Indice: alertas activas del tenant (para badges en la grilla)
CREATE INDEX idx_key_account_alerts_tenant_active
    ON public.key_account_alerts (tenant_id, status)
    WHERE status IN ('pending', 'triggered');

-- Indice: alertas pendientes por fecha de disparo (para evaluacion diaria)
CREATE INDEX idx_key_account_alerts_trigger_date
    ON public.key_account_alerts (trigger_date)
    WHERE status = 'pending' AND trigger_date IS NOT NULL;

-- RLS
ALTER TABLE public.key_account_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_account_alerts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS key_account_alerts_tenant_isolation ON public.key_account_alerts;
CREATE POLICY key_account_alerts_tenant_isolation
    ON public.key_account_alerts
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Permisos: SELECT, INSERT, UPDATE (para resolver/dismiss alertas)
GRANT SELECT, INSERT, UPDATE ON public.key_account_alerts TO authenticated;
REVOKE DELETE ON public.key_account_alerts FROM authenticated;

-- pymepilot_app: SELECT, INSERT (para alertas automaticas del motor)
GRANT SELECT, INSERT ON public.key_account_alerts TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.key_account_alerts FROM pymepilot_app;


-- =============================================================================
-- 4. Notificar a PostgREST que hay schema nuevo
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
