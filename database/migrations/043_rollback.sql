-- ============================================================
-- Rollback 043: Revertir Copy dinamico por etapa (JSONB → TEXT)
-- ============================================================
-- QUE HACE: Revierte la migracion 043_stage_messages_jsonb.sql
--   - Elimina la columna JSONB stage_messages
--   - Restaura la columna TEXT stage_message_text
-- ADVERTENCIA: La migracion original migro datos de stage_message_text
-- a stage_messages. Este rollback NO recupera esos datos — las notas
-- existentes en stage_messages se pierden.
-- ============================================================

BEGIN;

-- 1. Restaurar columna TEXT (la vieja)
ALTER TABLE public.pipeline_cards
    ADD COLUMN stage_message_text TEXT;

COMMENT ON COLUMN public.pipeline_cards.stage_message_text IS
  'Rollback: copy de venta generado por Claude para la etapa actual.';

-- 2. No hay migracion de datos hacia atras: stage_messages era JSONB
-- con multiple claves, stage_message_text era un solo texto. La
-- conversion inversa perderia datos y contexto.

-- 3. Eliminar la columna JSONB
ALTER TABLE public.pipeline_cards DROP COLUMN IF EXISTS stage_messages;

-- 4. Notificar a PostgREST que el schema cambio
NOTIFY pgrst, 'reload schema';

COMMIT;
