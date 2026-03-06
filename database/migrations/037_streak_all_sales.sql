-- ============================================================
-- Migration 037: get_streak_days cuenta CUALQUIER venta
-- ============================================================
-- Cambia la racha de "dias con conversiones atribuidas" a
-- "dias habiles con cualquier venta del ERP".
-- Esto motiva al vendedor independientemente de PymePilot.

CREATE OR REPLACE FUNCTION public.get_streak_days()
RETURNS int AS $$
DECLARE
    streak int := 0;
    check_date date := CURRENT_DATE;
    has_sale boolean;
BEGIN
    LOOP
        -- Saltear fines de semana (sabado=6, domingo=0)
        IF EXTRACT(DOW FROM check_date) IN (0, 6) THEN
            check_date := check_date - 1;
            CONTINUE;
        END IF;

        -- Verificar si hubo al menos 1 venta ese dia
        SELECT EXISTS(
            SELECT 1
            FROM orders o
            WHERE o.order_date::date = check_date
              AND o.status = 'completed'
        ) INTO has_sale;

        IF has_sale THEN
            streak := streak + 1;
            check_date := check_date - 1;
        ELSE
            EXIT;  -- Se rompio la racha
        END IF;

        -- Safety: no retroceder mas de 365 dias
        IF CURRENT_DATE - check_date > 365 THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN streak;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
