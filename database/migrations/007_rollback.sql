-- Rollback 007: Drop predictions table
DROP POLICY IF EXISTS predictions_tenant_isolation ON predictions;
DROP TABLE IF EXISTS predictions CASCADE;
