-- =============================================================================
-- Migracion 041: Pipeline CRM — Kanban de seguimiento comercial
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace: Crea 3 tablas para el pipeline visual tipo Kanban:
--   1. pipeline_cards: cada card = 1 prediccion en el pipeline
--   2. followups: seguimientos programados (1-3 por card)
--   3. contact_notes: registro de cada interaccion vendedor-cliente
-- Por que: El vendedor necesita un flujo visual para trackear el ciclo de
--   venta completo: desde la sugerencia de PymePilot hasta la venta cerrada.
-- Patron: Misma estructura RLS que el resto del proyecto (tenant_id + FORCE).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABLA pipeline_cards: una card por prediccion en el pipeline
-- =============================================================================
-- Concepto: Cada prediccion que PymePilot genera puede convertirse en una card
-- del pipeline. La card se mueve por columnas a medida que el vendedor avanza
-- en el proceso de venta.

CREATE TABLE public.pipeline_cards (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    prediction_id   uuid REFERENCES public.predictions(id) ON DELETE SET NULL,
    customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

    -- Estado en el pipeline
    column_name     text NOT NULL DEFAULT 'a_contactar',
    vertical        text NOT NULL,
    priority        integer NOT NULL DEFAULT 3,
    is_expired      boolean NOT NULL DEFAULT false,

    -- Timestamps
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_pipeline_column CHECK (
        column_name IN ('a_contactar', 'contactado', 'en_seguimiento',
                        'por_cotizar', 'cotizacion_enviada', 'vendido')
    ),
    CONSTRAINT valid_pipeline_vertical CHECK (
        vertical IN ('reposicion', 'activacion', 'cross_sell', 'recuperacion')
    ),
    CONSTRAINT valid_pipeline_priority CHECK (priority BETWEEN 1 AND 5)
);

COMMENT ON TABLE public.pipeline_cards IS
  'Cards del pipeline CRM Kanban. 1 card = 1 prediccion en seguimiento. RLS por tenant.';

-- Indice principal: obtener todas las cards del tenant (query del board)
CREATE INDEX idx_pipeline_cards_tenant
    ON public.pipeline_cards (tenant_id, column_name);

-- Indice para evitar duplicados: 1 card por prediccion
CREATE UNIQUE INDEX idx_pipeline_cards_prediction_unique
    ON public.pipeline_cards (prediction_id) WHERE prediction_id IS NOT NULL;

-- Indice para buscar cards por cliente
CREATE INDEX idx_pipeline_cards_customer
    ON public.pipeline_cards (tenant_id, customer_id);

-- Indice para cards vencidas (updated_at en a_contactar)
CREATE INDEX idx_pipeline_cards_expiry
    ON public.pipeline_cards (tenant_id, updated_at)
    WHERE column_name = 'a_contactar' AND is_expired = false;

-- RLS
ALTER TABLE public.pipeline_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_cards FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipeline_cards_tenant_isolation ON public.pipeline_cards;
CREATE POLICY pipeline_cards_tenant_isolation
    ON public.pipeline_cards
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Permisos: authenticated necesita SELECT, INSERT, UPDATE (mover cards), DELETE (descartar)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_cards TO authenticated;

-- pymepilot_app: SELECT, INSERT (crear cards desde orquestador si se necesita)
GRANT SELECT, INSERT ON public.pipeline_cards TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.pipeline_cards FROM pymepilot_app;


-- =============================================================================
-- 2. TABLA followups: seguimientos programados (1-3 por card)
-- =============================================================================
-- Concepto: Cuando el vendedor contacta a un cliente, PymePilot programa
-- automaticamente 1-3 seguimientos futuros con fechas calculadas segun la
-- vertical (o ajustadas por Claude si hay una nota del vendedor).

CREATE TABLE public.followups (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    card_id         uuid NOT NULL REFERENCES public.pipeline_cards(id) ON DELETE CASCADE,

    -- Secuencia
    sequence_number integer NOT NULL,
    scheduled_date  date NOT NULL,
    status          text NOT NULL DEFAULT 'pending',

    -- Timestamps
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    completed_at    timestamptz,

    -- Validaciones
    CONSTRAINT valid_followup_sequence CHECK (sequence_number BETWEEN 1 AND 3),
    CONSTRAINT valid_followup_status CHECK (
        status IN ('pending', 'completed', 'skipped')
    )
);

COMMENT ON TABLE public.followups IS
  'Seguimientos programados del pipeline. 1-3 por card. RLS por tenant.';

-- Indice principal: seguimientos de una card
CREATE INDEX idx_followups_card
    ON public.followups (card_id, sequence_number);

-- Indice: seguimientos pendientes de hoy (para badges "HOY")
CREATE INDEX idx_followups_pending_today
    ON public.followups (tenant_id, scheduled_date)
    WHERE status = 'pending';

-- Indice: evitar duplicados de secuencia por card
CREATE UNIQUE INDEX idx_followups_card_sequence_unique
    ON public.followups (card_id, sequence_number);

-- RLS
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS followups_tenant_isolation ON public.followups;
CREATE POLICY followups_tenant_isolation
    ON public.followups
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Permisos: authenticated necesita SELECT, INSERT, UPDATE (marcar completed/skipped), DELETE (discard cascade)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followups TO authenticated;

-- pymepilot_app: SELECT, INSERT
GRANT SELECT, INSERT ON public.followups TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.followups FROM pymepilot_app;


-- =============================================================================
-- 3. TABLA contact_notes: registro de cada interaccion
-- =============================================================================
-- Concepto: Cada vez que el vendedor interactua con una card (la contacta,
-- hace un seguimiento, etc.), se registra el resultado y una nota opcional.
-- Es un log append-only: nunca se edita ni se borra.

CREATE TABLE public.contact_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    card_id         uuid NOT NULL REFERENCES public.pipeline_cards(id) ON DELETE CASCADE,

    -- Resultado de la interaccion
    result          text NOT NULL,
    note_text       text,
    followup_id     uuid REFERENCES public.followups(id) ON DELETE SET NULL,

    -- Timestamp
    created_at      timestamptz NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_contact_result CHECK (
        result IN ('contesto', 'no_contesto', 'pidio_cotizacion')
    )
);

COMMENT ON TABLE public.contact_notes IS
  'Log append-only de interacciones del vendedor con cards del pipeline. RLS por tenant.';

-- Indice: notas de una card (historial)
CREATE INDEX idx_contact_notes_card
    ON public.contact_notes (card_id, created_at DESC);

-- Indice: notas por tenant y fecha (para reportes)
CREATE INDEX idx_contact_notes_tenant_date
    ON public.contact_notes (tenant_id, created_at DESC);

-- RLS
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_notes_tenant_isolation ON public.contact_notes;
CREATE POLICY contact_notes_tenant_isolation
    ON public.contact_notes
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Permisos: authenticated — SELECT + INSERT + DELETE (para discard cascade)
GRANT SELECT, INSERT, DELETE ON public.contact_notes TO authenticated;
REVOKE UPDATE ON public.contact_notes FROM authenticated;

-- pymepilot_app: SELECT, INSERT
GRANT SELECT, INSERT ON public.contact_notes TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.contact_notes FROM pymepilot_app;


-- =============================================================================
-- 4. FUNCION sync_predictions_to_pipeline: crea cards para predicciones nuevas
-- =============================================================================
-- Concepto: Cuando el vendedor abre /pipeline, esta funcion crea cards para
-- predicciones recientes (ultimos 30 dias) que aun no tienen card.
-- Se llama desde el frontend (via PostgREST RPC) para mantener el pipeline
-- sincronizado sin modificar el orquestador Python.

CREATE OR REPLACE FUNCTION public.sync_predictions_to_pipeline()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
    v_count integer;
BEGIN
    -- Obtener tenant del contexto RLS
    v_tenant_id := get_current_tenant_id();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant context set';
    END IF;

    -- Insertar cards para predicciones que no tienen card aun
    -- Solo predicciones de los ultimos 30 dias con status pending/contacted
    INSERT INTO public.pipeline_cards (tenant_id, prediction_id, customer_id, column_name, vertical, priority)
    SELECT
        p.tenant_id,
        p.id,
        p.customer_id,
        CASE
            WHEN p.status = 'contacted' THEN 'contactado'
            ELSE 'a_contactar'
        END,
        p.vertical,
        p.priority
    FROM public.predictions p
    WHERE p.tenant_id = v_tenant_id
      AND p.prediction_date >= CURRENT_DATE - INTERVAL '30 days'
      AND p.status IN ('pending', 'contacted')
      AND NOT EXISTS (
          SELECT 1 FROM public.pipeline_cards pc
          WHERE pc.prediction_id = p.id
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.sync_predictions_to_pipeline IS
  'Crea pipeline_cards para predicciones recientes sin card. Retorna cantidad creada.';

-- Permisos: authenticated puede llamar esta funcion
GRANT EXECUTE ON FUNCTION public.sync_predictions_to_pipeline() TO authenticated;


-- =============================================================================
-- 5. FUNCION update_pipeline_card_timestamp: trigger para updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_pipeline_card_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pipeline_cards_updated_at
    BEFORE UPDATE ON public.pipeline_cards
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pipeline_card_timestamp();


-- =============================================================================
-- 6. Notificar a PostgREST que hay schema nuevo
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
