-- Rollback 037: Restaurar get_streak_days original (solo conversiones atribuidas)

CREATE OR REPLACE FUNCTION public.get_streak_days()
RETURNS int AS $$
DECLARE
    streak int := 0;
    check_date date := CURRENT_DATE;
    has_conversion boolean;
BEGIN
    LOOP
        IF EXTRACT(DOW FROM check_date) IN (0, 6) THEN
            check_date := check_date - 1;
            CONTINUE;
        END IF;

        SELECT EXISTS(
            SELECT 1
            FROM predictions p
            WHERE p.status = 'completed'
              AND p.metadata ? 'attribution_date'
              AND (p.metadata->>'attribution_date')::date = check_date
        ) INTO has_conversion;

        IF has_conversion THEN
            streak := streak + 1;
            check_date := check_date - 1;
        ELSE
            EXIT;
        END IF;

        IF CURRENT_DATE - check_date > 365 THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN streak;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
