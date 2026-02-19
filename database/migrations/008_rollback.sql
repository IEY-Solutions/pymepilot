-- Rollback 008: Drop sync_log table
DROP POLICY IF EXISTS sync_log_tenant_isolation ON sync_log;
DROP TABLE IF EXISTS sync_log CASCADE;
