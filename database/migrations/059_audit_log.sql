-- Migration 059: Append-only security audit log
-- Description: Immutable audit trail for security and operational events.
--
-- Design decisions:
-- - INSERT-only grant for the application user; no UPDATE/DELETE/TRUNCATE.
-- - IP addresses are stored as SHA-256 hashes; raw IPs are never persisted.
-- - Events are keyed by actor (user + tenant), action, resource, result,
--   correlation_id, and severity for observability cross-reference.

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_user_id UUID,
    actor_tenant_id UUID NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    result TEXT NOT NULL,
    correlation_id TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    ip_hash TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- Index for time-series queries and severity investigations.
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_tenant ON audit_log (actor_tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action, timestamp DESC);

-- INSERT-only access for the application user. No update, delete, or truncate.
GRANT INSERT, SELECT ON audit_log TO pymepilot_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pymepilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pymepilot_app;

-- Force RLS so even the table owner respects tenant isolation when querying.
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- Tenants can only read their own audit events. The app inserts events
-- explicitly tagged with the actor's tenant_id.
CREATE POLICY audit_log_tenant_isolation ON audit_log
    FOR SELECT
    TO pymepilot_app
    USING (actor_tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Allow the application user to insert audit events only for the active tenant.
CREATE POLICY audit_log_app_insert ON audit_log
    FOR INSERT
    TO pymepilot_app
    WITH CHECK (actor_tenant_id = current_setting('app.current_tenant_id')::UUID);
