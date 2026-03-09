-- =============================================================================
-- Migracion 044: Sistema de followups completo — timers, origen, notificaciones
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace: Agrega infraestructura para el sistema completo de followups:
--   1. stage_deadline en pipeline_cards (timer por etapa)
--   2. origin_stage en followups (de donde vino el seguimiento)
--   3. next_reposition_estimate en predictions (cierre del ciclo)
--   4. followup_notifications (registro de notificaciones push)
-- Por que: El pipeline necesita timers automaticos (auto-mover cards vencidas),
--   secuencias diferenciadas por origen, y registro de notificaciones para no
--   duplicar avisos al vendedor.
-- Patron: ALTER TABLE con columnas nullable (no rompe queries existentes).
--   Tabla nueva con RLS + FORCE RLS (patron multi-tenant del proyecto).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. pipeline_cards.stage_deadline: fecha limite de la etapa actual
-- =============================================================================
-- Concepto: Cada etapa tiene un timer. Cuando stage_deadline pasa sin que
-- el vendedor actue, la card se auto-mueve a "en_seguimiento".
-- Timers: contactado=2 dias, por_cotizar=1 dia, cotizacion_enviada=1 dia.
-- NULL significa que la etapa no tiene timer (a_contactar, vendido).

ALTER TABLE public.pipeline_cards
    ADD COLUMN stage_deadline DATE;

COMMENT ON COLUMN public.pipeline_cards.stage_deadline IS
  'Fecha limite de la etapa actual. NULL para etapas sin timer (a_contactar, en_seguimiento, vendido).';

-- Indice para encontrar cards vencidas eficientemente
CREATE INDEX idx_pipeline_cards_deadline
    ON public.pipeline_cards (tenant_id, stage_deadline)
    WHERE stage_deadline IS NOT NULL AND column_name NOT IN ('a_contactar', 'en_seguimiento', 'vendido');


-- =============================================================================
-- 2. followups.origin_stage: desde que etapa se creo el followup
-- =============================================================================
-- Concepto: Los followups tienen secuencias distintas segun la etapa de origen.
-- contactado usa la secuencia de la vertical (ej: [2,5,10] para reposicion).
-- por_cotizar usa [1,3,5] (agresivo, cliente ya mostro interes).
-- cotizacion_enviada usa [2,4,7] (insistir moderado).

ALTER TABLE public.followups
    ADD COLUMN origin_stage TEXT
    CHECK (origin_stage IN ('contactado', 'por_cotizar', 'cotizacion_enviada'));

COMMENT ON COLUMN public.followups.origin_stage IS
  'Etapa desde la cual se creo este followup. Determina la secuencia de dias.';


-- =============================================================================
-- 3. predictions.next_reposition_estimate: cierre del ciclo de venta
-- =============================================================================
-- Concepto: Cuando una card llega a "vendido" y la vertical es reposicion,
-- se calcula cuando el cliente probablemente necesite reponer. El motor
-- Python usa esta fecha para generar una nueva prediccion.

ALTER TABLE public.predictions
    ADD COLUMN next_reposition_estimate DATE;

COMMENT ON COLUMN public.predictions.next_reposition_estimate IS
  'Fecha estimada de proxima reposicion. Solo para vertical reposicion. Calculada al cerrar venta.';


-- =============================================================================
-- 4. Tabla followup_notifications: registro de notificaciones enviadas
-- =============================================================================
-- Concepto: Cada vez que el sistema detecta un followup del dia, crea una
-- notificacion push. Esta tabla evita enviar duplicados: si ya existe un
-- registro con status=sent para ese followup, no se vuelve a notificar.

CREATE TABLE public.followup_notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    followup_id     uuid NOT NULL REFERENCES public.followups(id) ON DELETE CASCADE,

    -- Canal y estado
    channel         text NOT NULL DEFAULT 'push'
        CHECK (channel IN ('push', 'notion', 'google_calendar')),
    status          text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),

    -- Scheduling
    scheduled_at    timestamptz NOT NULL,
    sent_at         timestamptz,

    -- Contenido (para push)
    title           text,
    body            text,

    -- Metadata
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.followup_notifications IS
  'Registro de notificaciones de followups. Evita duplicados. RLS por tenant.';

-- Indice: notificaciones pendientes por tenant y fecha
CREATE INDEX idx_followup_notif_pending
    ON public.followup_notifications (tenant_id, scheduled_at)
    WHERE status = 'pending';

-- Indice: buscar por followup (verificar si ya se notifico)
CREATE INDEX idx_followup_notif_followup
    ON public.followup_notifications (followup_id);

-- RLS
ALTER TABLE public.followup_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS followup_notifications_tenant_isolation ON public.followup_notifications;
CREATE POLICY followup_notifications_tenant_isolation
    ON public.followup_notifications
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Permisos: authenticated necesita SELECT + INSERT (crear notif) + UPDATE (marcar sent)
GRANT SELECT, INSERT, UPDATE ON public.followup_notifications TO authenticated;
REVOKE DELETE ON public.followup_notifications FROM authenticated;

-- pymepilot_app: SELECT, INSERT (si el motor necesita crear notificaciones)
GRANT SELECT, INSERT ON public.followup_notifications TO pymepilot_app;
REVOKE UPDATE, DELETE ON public.followup_notifications FROM pymepilot_app;


-- =============================================================================
-- 5. Notificar a PostgREST que el schema cambio
-- =============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
