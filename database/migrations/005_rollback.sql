-- Rollback 005: Drop products table
DROP POLICY IF EXISTS products_tenant_isolation ON products;
DROP TABLE IF EXISTS products CASCADE;
