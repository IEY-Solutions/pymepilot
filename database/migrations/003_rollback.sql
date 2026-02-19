-- Rollback 003: Drop user_profiles table
DROP POLICY IF EXISTS user_profiles_tenant_isolation ON user_profiles;
DROP TABLE IF EXISTS user_profiles CASCADE;
