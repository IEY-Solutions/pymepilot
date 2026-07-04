-- Rollback 060: Restore historical audit_log policy state from 059

BEGIN;

REVOKE INSERT ON public.audit_log FROM anon, authenticated;
REVOKE SELECT ON public.audit_log FROM authenticated;

DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
DROP POLICY IF EXISTS audit_log_app_insert ON audit_log;

CREATE POLICY audit_log_tenant_isolation ON audit_log
    FOR SELECT
    TO pymepilot_app
    USING (actor_tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY audit_log_app_insert ON audit_log
    FOR INSERT
    TO pymepilot_app
    WITH CHECK (actor_tenant_id = current_setting('app.current_tenant_id')::UUID);

NOTIFY pgrst, 'reload schema';

COMMIT;
