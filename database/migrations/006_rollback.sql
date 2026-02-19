-- Rollback 006: Drop orders and order_items tables
DROP POLICY IF EXISTS order_items_tenant_isolation ON order_items;
DROP POLICY IF EXISTS orders_tenant_isolation ON orders;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
