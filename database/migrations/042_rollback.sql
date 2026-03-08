-- Rollback 042: Quitar columna stage_message_text
ALTER TABLE public.pipeline_cards DROP COLUMN IF EXISTS stage_message_text;
