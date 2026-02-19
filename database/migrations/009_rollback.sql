-- Rollback 009: Drop additional indexes
DROP INDEX IF EXISTS idx_orders_customer_date;
DROP INDEX IF EXISTS idx_order_items_product_customer;
DROP INDEX IF EXISTS idx_predictions_dashboard;
DROP INDEX IF EXISTS idx_sync_log_last_success;
DROP INDEX IF EXISTS idx_customers_inactivity;
DROP INDEX IF EXISTS idx_customers_new;
