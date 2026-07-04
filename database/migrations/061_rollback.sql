-- Rollback 061: Restore audit_log access state from 060 while keeping an app write path

BEGIN;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

REVOKE INSERT ON public.audit_log FROM anon, authenticated, pymepilot_app;
GRANT INSERT ON public.audit_log TO pymepilot_app;
GRANT SELECT ON public.audit_log TO authenticated, pymepilot_app;

DROP POLICY IF EXISTS audit_log_app_select ON audit_log;
DROP POLICY IF EXISTS audit_log_authenticated_insert ON audit_log;
DROP POLICY IF EXISTS audit_log_app_insert ON audit_log;

DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
CREATE POLICY audit_log_tenant_isolation ON audit_log
    FOR SELECT
    TO authenticated
    USING (actor_tenant_id = get_current_tenant_id());

CREATE POLICY audit_log_app_select ON audit_log
    FOR SELECT
    TO pymepilot_app
    USING (actor_tenant_id = get_current_tenant_id());

CREATE POLICY audit_log_app_insert ON audit_log
    FOR INSERT
    TO pymepilot_app
    WITH CHECK (actor_tenant_id = get_current_tenant_id());

NOTIFY pgrst, 'reload schema';

COMMIT;
