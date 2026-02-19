-- Rollback 010: Drop helper functions and triggers
DROP TRIGGER IF EXISTS set_updated_at_predictions ON predictions;
DROP TRIGGER IF EXISTS set_updated_at_products ON products;
DROP TRIGGER IF EXISTS set_updated_at_customers ON customers;
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON user_profiles;
DROP TRIGGER IF EXISTS set_updated_at_tenants ON tenants;

DROP FUNCTION IF EXISTS get_tenant_id_by_slug(TEXT);
DROP FUNCTION IF EXISTS set_tenant_context(UUID);
DROP FUNCTION IF EXISTS trigger_set_updated_at();
