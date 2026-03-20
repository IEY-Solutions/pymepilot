-- ============================================================
-- Migracion 056: Fixes de seguridad post-auditoria MVP
-- ============================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- C-01: Agregar filtro tenant_id en 6 funciones KPI (get_total_sales,
--       get_monthly_revenue_split, get_monthly_churn, get_monthly_ticket,
--       get_client_trends, get_monthly_value)
-- H-02: GRANT UPDATE en key_accounts con lista especifica de columnas
--       (excluye tenant_id, customer_id, created_at)
-- H-03: REVOKE ALL FROM PUBLIC en 3 RPCs de key_accounts
-- H-04: Funcion batch recalculate_key_account_health_scores
-- M-08: REVOKE DELETE ON contact_notes FROM authenticated (append-only)
--
-- POR QUE:
-- C-01: Las 6 RPCs de KPI filtran por RLS sobre orders/predictions PERO
--       las funciones tienen SECURITY DEFINER que evita RLS. Sin filtro
--       explicito de tenant_id, un tenant podria ver datos de otro.
-- H-02: GRANT UPDATE sin lista de columnas permite actualizar tenant_id
--       y customer_id, lo que romperia el aislamiento multi-tenant.
-- H-03: EXECUTE otorgado a PUBLIC por default de PostgreSQL en SECURITY
--       DEFINER. Solo authenticated debe poder ejecutar estas RPCs.
-- H-04: El loop N+1 actual (1 RPC por cuenta clave) es ineficiente.
--       Una funcion batch lo resuelve en 1 roundtrip.
-- M-08: contact_notes es append-only por diseno pero tenia GRANT DELETE.
--
-- ============================================================

BEGIN;

-- ============================================================
-- C-01: Agregar filtro AND o.tenant_id = get_current_tenant_id()
-- en las 6 funciones KPI
-- ============================================================
-- NOTA: get_total_sales() ya fue recreada en 053. Las otras 5 vienen
-- de 034_audit_security_hardening.sql. Como tienen SECURITY DEFINER
-- no aplica RLS automaticamente, necesitan filtro explicito.

-- C-01a. get_total_sales (fue recreada en 053 sin tenant_id filter)
CREATE OR REPLACE FUNCTION public.get_total_sales(
    p_months int DEFAULT 2
)
RETURNS TABLE (
    month date,
    total_orders bigint,
    total_revenue numeric
) AS $$
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        COUNT(*) AS total_orders,
        COALESCE(SUM(o.total_amount), 0) AS total_revenue
    FROM orders o
    WHERE o.status = 'completed'
      AND o.tenant_id = get_current_tenant_id()
      AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_total_sales(int) TO authenticated;

-- C-01b. get_monthly_revenue_split
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_split(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    total_revenue numeric,
    recurring_revenue numeric,
    new_revenue numeric,
    recurring_pct numeric
) AS $$
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        SUM(o.total_amount) AS total_revenue,
        SUM(CASE WHEN c.total_purchases_count >= 2
            THEN o.total_amount ELSE 0 END) AS recurring_revenue,
        SUM(CASE WHEN c.total_purchases_count < 2
            THEN o.total_amount ELSE 0 END) AS new_revenue,
        ROUND(
            SUM(CASE WHEN c.total_purchases_count >= 2
                THEN o.total_amount ELSE 0 END)
            / NULLIF(SUM(o.total_amount), 0) * 100,
            1
        ) AS recurring_pct
    FROM orders o
    JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
    WHERE o.status = 'completed'
      AND o.tenant_id = get_current_tenant_id()
      AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_monthly_revenue_split(int) TO authenticated;

-- C-01c. get_monthly_churn
CREATE OR REPLACE FUNCTION public.get_monthly_churn(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    active_prev int,
    churned int,
    churn_rate numeric
) AS $$
    WITH monthly_active AS (
        SELECT DISTINCT
            date_trunc('month', o.order_date)::date AS month,
            o.customer_id
        FROM orders o
        WHERE o.status = 'completed'
          AND o.tenant_id = get_current_tenant_id()
    ),
    month_pairs AS (
        SELECT
            prev.month + interval '1 month' AS curr_month,
            prev.customer_id,
            CASE WHEN curr.customer_id IS NULL THEN 1 ELSE 0 END AS is_churned
        FROM monthly_active prev
        LEFT JOIN monthly_active curr
            ON curr.customer_id = prev.customer_id
            AND curr.month = prev.month + interval '1 month'
        WHERE prev.month >= date_trunc('month', CURRENT_DATE)::date
              - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
          AND prev.month < date_trunc('month', CURRENT_DATE)::date
    )
    SELECT
        curr_month::date AS month,
        COUNT(*)::int AS active_prev,
        SUM(is_churned)::int AS churned,
        ROUND(
            SUM(is_churned)::numeric
            / NULLIF(COUNT(*), 0) * 100,
            1
        ) AS churn_rate
    FROM month_pairs
    GROUP BY curr_month
    ORDER BY curr_month;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_monthly_churn(int) TO authenticated;

-- C-01d. get_monthly_ticket
CREATE OR REPLACE FUNCTION public.get_monthly_ticket(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    avg_ticket numeric,
    avg_ticket_recurring numeric,
    avg_ticket_new numeric
) AS $$
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        ROUND(AVG(o.total_amount), 0) AS avg_ticket,
        ROUND(AVG(CASE WHEN c.total_purchases_count >= 2
            THEN o.total_amount END), 0) AS avg_ticket_recurring,
        ROUND(AVG(CASE WHEN c.total_purchases_count < 2
            THEN o.total_amount END), 0) AS avg_ticket_new
    FROM orders o
    JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
    WHERE o.status = 'completed'
      AND o.tenant_id = get_current_tenant_id()
      AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', o.order_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_monthly_ticket(int) TO authenticated;

-- C-01e. get_client_trends
CREATE OR REPLACE FUNCTION public.get_client_trends(
    p_months_window int DEFAULT 3
)
RETURNS TABLE (
    customer_id uuid,
    recent_revenue numeric,
    previous_revenue numeric,
    trend text
) AS $$
    WITH recent AS (
        SELECT
            o.customer_id,
            COALESCE(SUM(o.total_amount), 0) AS revenue
        FROM orders o
        WHERE o.status = 'completed'
          AND o.tenant_id = get_current_tenant_id()
          AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
              - (LEAST(GREATEST(p_months_window, 1), 24) || ' months')::interval
        GROUP BY o.customer_id
    ),
    previous AS (
        SELECT
            o.customer_id,
            COALESCE(SUM(o.total_amount), 0) AS revenue
        FROM orders o
        WHERE o.status = 'completed'
          AND o.tenant_id = get_current_tenant_id()
          AND o.order_date >= date_trunc('month', CURRENT_DATE)::date
              - (2 * LEAST(GREATEST(p_months_window, 1), 24) || ' months')::interval
          AND o.order_date < date_trunc('month', CURRENT_DATE)::date
              - (LEAST(GREATEST(p_months_window, 1), 24) || ' months')::interval
        GROUP BY o.customer_id
    )
    SELECT
        COALESCE(r.customer_id, p.customer_id) AS customer_id,
        COALESCE(r.revenue, 0) AS recent_revenue,
        COALESCE(p.revenue, 0) AS previous_revenue,
        CASE
            WHEN COALESCE(p.revenue, 0) = 0 AND COALESCE(r.revenue, 0) > 0 THEN 'up'
            WHEN COALESCE(r.revenue, 0) = 0 AND COALESCE(p.revenue, 0) > 0 THEN 'down'
            WHEN COALESCE(p.revenue, 0) = 0 AND COALESCE(r.revenue, 0) = 0 THEN 'stable'
            WHEN (r.revenue - p.revenue) / p.revenue > 0.10 THEN 'up'
            WHEN (p.revenue - r.revenue) / p.revenue > 0.10 THEN 'down'
            ELSE 'stable'
        END AS trend
    FROM recent r
    FULL OUTER JOIN previous p ON p.customer_id = r.customer_id;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_client_trends(int) TO authenticated;

-- C-01f. get_monthly_value
CREATE OR REPLACE FUNCTION public.get_monthly_value(
    p_months int DEFAULT 6
)
RETURNS TABLE (
    month date,
    attributed_value numeric,
    predictions_converted int
) AS $$
    SELECT
        date_trunc('month', p.prediction_date)::date AS month,
        COALESCE(
            SUM(
                CASE
                    WHEN p.metadata->>'attribution_amount' ~ '^\d+(\.\d+)?$'
                    THEN (p.metadata->>'attribution_amount')::numeric
                    ELSE 0
                END
            ),
            0
        ) AS attributed_value,
        COUNT(*)::int AS predictions_converted
    FROM predictions p
    WHERE p.status = 'completed'
      AND p.tenant_id = get_current_tenant_id()
      AND p.metadata ? 'attribution_amount'
      AND p.prediction_date >= date_trunc('month', CURRENT_DATE)::date
          - (LEAST(GREATEST(p_months, 1), 24) || ' months')::interval
    GROUP BY date_trunc('month', p.prediction_date)
    ORDER BY month;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_monthly_value(int) TO authenticated;

-- ============================================================
-- H-02: GRANT UPDATE en key_accounts con columnas especificas
-- ============================================================
-- Solo columnas que el operador puede modificar.
-- Excluye: tenant_id, customer_id, created_at (inmutables)
-- Excluye: created_by (se establece en INSERT, no debe cambiar)
REVOKE UPDATE ON public.key_accounts FROM authenticated;
GRANT UPDATE (
    status,
    health_score,
    health_override,
    source,
    notes_count,
    pending_actions_count
) ON public.key_accounts TO authenticated;

-- ============================================================
-- H-03: REVOKE ALL FROM PUBLIC en las 3 RPCs de key_accounts
-- ============================================================
-- Por defecto PostgreSQL otorga EXECUTE a PUBLIC para funciones nuevas.
-- Solo authenticated (usuarios logueados) debe poder ejecutarlas.

REVOKE ALL ON FUNCTION public.get_key_account_health_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_key_account_health_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_key_account_health_score(uuid) TO pymepilot_app;

REVOKE ALL ON FUNCTION public.get_key_account_financial_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_key_account_financial_summary(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.suggest_key_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_key_accounts() TO authenticated;

-- ============================================================
-- H-04: Funcion batch recalculate_key_account_health_scores
-- ============================================================
-- Reemplaza el loop N+1 en /api/key-accounts/route.ts
-- Calcula y actualiza health_score para TODAS las cuentas del tenant
-- que NO tienen health_override en un solo roundtrip.
--
-- Retorna las cuentas actualizadas para que el API route pueda
-- devolver datos frescos sin hacer un segundo fetch.

-- SEGURIDAD: La funcion NO acepta p_tenant_id del caller.
-- Usa get_current_tenant_id() de la sesion activa para prevenir que un
-- usuario autenticado modifique datos de otro tenant invocando la funcion
-- directamente con un tenant_id arbitrario.
CREATE OR REPLACE FUNCTION public.recalculate_key_account_health_scores()
RETURNS TABLE (
    account_id uuid,
    customer_id uuid,
    new_health_score text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
    v_account   RECORD;
    v_new_score text;
BEGIN
    -- Obtener tenant de la sesion activa (no del caller)
    v_tenant_id := get_current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id no disponible en la sesion actual';
    END IF;

    -- Iterar sobre cuentas activas sin override del tenant autenticado
    FOR v_account IN
        SELECT ka.id AS account_id, ka.customer_id
        FROM key_accounts ka
        WHERE ka.tenant_id = v_tenant_id
          AND ka.status = 'active'
          AND ka.health_override IS NULL
    LOOP
        -- Calcular health score para este cliente
        SELECT public.get_key_account_health_score(v_account.customer_id)
        INTO v_new_score;

        -- Actualizar solo si cambio
        UPDATE key_accounts
        SET health_score = v_new_score
        WHERE id = v_account.account_id
          AND health_score IS DISTINCT FROM v_new_score;

        -- Retornar resultado
        account_id := v_account.account_id;
        customer_id := v_account.customer_id;
        new_health_score := v_new_score;
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.recalculate_key_account_health_scores() IS
  'Recalcula y actualiza health_score para todas las cuentas activas del tenant autenticado sin override. Usa get_current_tenant_id() internamente — no acepta tenant_id del caller.';

REVOKE ALL ON FUNCTION public.recalculate_key_account_health_scores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_key_account_health_scores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_key_account_health_scores() TO pymepilot_app;

-- ============================================================
-- M-08: REVOKE DELETE ON contact_notes FROM authenticated
-- ============================================================
-- contact_notes es append-only por diseno (ver migration 041).
-- El GRANT DELETE original fue un error. El CASCADE de FK cuando
-- se elimina una pipeline_card ya lo maneja PostgreSQL como owner.
REVOKE DELETE ON public.contact_notes FROM authenticated;

-- ============================================================
-- NOTIFICAR PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
