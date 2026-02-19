-- Rollback 004: Drop customers table
DROP POLICY IF EXISTS customers_tenant_isolation ON customers;
DROP TABLE IF EXISTS customers CASCADE;
