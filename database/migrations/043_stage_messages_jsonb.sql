-- =============================================================================
-- Migracion 043: Copy dinamico por etapa — de TEXT a JSONB (cache por etapa)
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- Que hace: Reemplaza stage_message_text (1 solo copy que se pisa) por
--   stage_messages (JSONB con 1 copy por etapa, cacheado).
-- Por que: El copy se generaba cada vez que la card cambiaba de etapa,
--   sobreescribiendo el anterior. Si el vendedor volvia a una etapa,
--   se perdia el copy y se gastaban tokens regenerandolo.
-- Patron: JSONB para key-value simple. Las keys son los nombres de las
--   etapas (en_seguimiento, por_cotizar, cotizacion_enviada).
-- =============================================================================

BEGIN;

-- 1. Agregar nueva columna JSONB
ALTER TABLE public.pipeline_cards
    ADD COLUMN stage_messages JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.pipeline_cards.stage_messages IS
  'Cache de copies de venta por etapa. Keys: en_seguimiento, por_cotizar, cotizacion_enviada. Generados por Claude.';

-- 2. Migrar datos existentes (si hay stage_message_text, guardarlo bajo la etapa actual)
UPDATE public.pipeline_cards
SET stage_messages = jsonb_build_object(column_name, stage_message_text)
WHERE stage_message_text IS NOT NULL AND stage_message_text != '';

-- 3. Eliminar la columna vieja
ALTER TABLE public.pipeline_cards DROP COLUMN stage_message_text;

-- 4. Notificar a PostgREST que el schema cambio
NOTIFY pgrst, 'reload schema';

COMMIT;
