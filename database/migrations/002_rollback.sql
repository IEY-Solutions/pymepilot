-- Rollback 002: Drop tenants table
-- PELIGROSO: Elimina todos los tenants y por CASCADE todos los datos relacionados
DROP TABLE IF EXISTS tenants CASCADE;
