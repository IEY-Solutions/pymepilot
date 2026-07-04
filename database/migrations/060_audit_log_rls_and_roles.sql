-- Migration 060: Audit log RLS and Supabase role access
-- Description: Follow-up fix for audit_log after preserving historical 059.

BEGIN;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

GRANT INSERT ON public.audit_log TO anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
DROP POLICY IF EXISTS audit_log_app_insert ON audit_log;

CREATE POLICY audit_log_tenant_isolation ON audit_log
    FOR SELECT
    TO authenticated
    USING (actor_tenant_id = COALESCE(get_current_tenant_id(), '00000000-0000-0000-0000-000000000000'::UUID));

CREATE POLICY audit_log_app_insert ON audit_log
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (actor_tenant_id = COALESCE(get_current_tenant_id(), '00000000-0000-0000-0000-000000000000'::UUID));

NOTIFY pgrst, 'reload schema';

COMMIT;
