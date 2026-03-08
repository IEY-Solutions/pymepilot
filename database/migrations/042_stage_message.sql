-- 042: Agregar copy dinamico por etapa al pipeline
-- Guarda el mensaje de venta generado por Claude, adaptado a la etapa actual

ALTER TABLE public.pipeline_cards ADD COLUMN stage_message_text TEXT;

COMMENT ON COLUMN public.pipeline_cards.stage_message_text IS 'Copy de venta generado por Claude, adaptado a la etapa actual del pipeline';

-- Notificar a PostgREST que el schema cambio (sin esto, PostgREST no ve la columna nueva)
NOTIFY pgrst, 'reload schema';
