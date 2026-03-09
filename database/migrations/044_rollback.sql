-- =============================================================================
-- Rollback 044: Revertir sistema de followups completo
-- =============================================================================
-- EJECUTAR CONTRA: orion_db

BEGIN;

-- 4. Eliminar tabla followup_notifications
DROP TABLE IF EXISTS public.followup_notifications CASCADE;

-- 3. Eliminar next_reposition_estimate de predictions
ALTER TABLE public.predictions DROP COLUMN IF EXISTS next_reposition_estimate;

-- 2. Eliminar origin_stage de followups
ALTER TABLE public.followups DROP COLUMN IF EXISTS origin_stage;

-- 1. Eliminar stage_deadline de pipeline_cards (y su indice)
DROP INDEX IF EXISTS public.idx_pipeline_cards_deadline;
ALTER TABLE public.pipeline_cards DROP COLUMN IF EXISTS stage_deadline;

NOTIFY pgrst, 'reload schema';

COMMIT;
