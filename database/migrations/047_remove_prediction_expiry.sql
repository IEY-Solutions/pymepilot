-- Migration 047: Eliminar filtro de 30 dias en sync_predictions_to_pipeline
-- Motivo: Las predicciones nunca expiran — el operador decide cuando descartar.
-- La señal visual (is_expired) se mantiene, pero la sincronizacion no filtra por fecha.

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
    -- Sin filtro de fecha: toda prediccion pending/contacted se sincroniza
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
  'Crea pipeline_cards para predicciones sin card. Sin limite de fecha — el operador decide.';

GRANT EXECUTE ON FUNCTION public.sync_predictions_to_pipeline() TO authenticated;

-- Notificar a PostgREST del cambio
NOTIFY pgrst, 'reload schema';
