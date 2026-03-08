-- =============================================================================
-- ROLLBACK 041: Eliminar tablas del Pipeline CRM
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Orden inverso: primero contact_notes (depende de followups y pipeline_cards),
-- luego followups (depende de pipeline_cards), luego pipeline_cards.
-- =============================================================================

BEGIN;

-- Eliminar funciones
DROP TRIGGER IF EXISTS trg_pipeline_cards_updated_at ON public.pipeline_cards;
DROP FUNCTION IF EXISTS public.update_pipeline_card_timestamp();
DROP FUNCTION IF EXISTS public.sync_predictions_to_pipeline();

-- Eliminar policies
DROP POLICY IF EXISTS contact_notes_tenant_isolation ON public.contact_notes;
DROP POLICY IF EXISTS followups_tenant_isolation ON public.followups;
DROP POLICY IF EXISTS pipeline_cards_tenant_isolation ON public.pipeline_cards;

-- Eliminar tablas (orden inverso de dependencias)
DROP TABLE IF EXISTS public.contact_notes;
DROP TABLE IF EXISTS public.followups;
DROP TABLE IF EXISTS public.pipeline_cards;

NOTIFY pgrst, 'reload schema';

COMMIT;
