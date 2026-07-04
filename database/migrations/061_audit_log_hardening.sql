-- Migration 061: Harden audit_log access for authenticated and service roles

BEGIN;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

REVOKE INSERT ON public.audit_log FROM anon, authenticated, pymepilot_app;
GRANT SELECT ON public.audit_log TO authenticated, pymepilot_app;

CREATE OR REPLACE FUNCTION public.record_audit_log(
    p_actor_user_id UUID,
    p_actor_tenant_id UUID,
    p_action TEXT,
    p_resource TEXT,
    p_result TEXT,
    p_correlation_id TEXT,
    p_severity TEXT,
    p_ip_hash TEXT,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO audit_log (
        actor_user_id,
        actor_tenant_id,
        action,
        resource,
        result,
        correlation_id,
        severity,
        ip_hash,
        details
    ) VALUES (
        p_actor_user_id,
        p_actor_tenant_id,
        p_action,
        p_resource,
        p_result,
        p_correlation_id,
        p_severity,
        p_ip_hash,
        COALESCE(p_details, '{}'::jsonb)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_audit_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_audit_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
DROP POLICY IF EXISTS audit_log_app_select ON audit_log;
DROP POLICY IF EXISTS audit_log_authenticated_insert ON audit_log;
DROP POLICY IF EXISTS audit_log_app_insert ON audit_log;

CREATE POLICY audit_log_tenant_isolation ON audit_log
    FOR SELECT
    TO authenticated
    USING (actor_tenant_id = get_current_tenant_id());

CREATE POLICY audit_log_app_select ON audit_log
    FOR SELECT
    TO pymepilot_app
    USING (actor_tenant_id = get_current_tenant_id());

NOTIFY pgrst, 'reload schema';

COMMIT;
