-- Rollback 025: Restaurar indice original
DROP INDEX IF EXISTS idx_customers_activation;

CREATE INDEX IF NOT EXISTS idx_customers_new
    ON customers(tenant_id, first_purchase_date DESC)
    WHERE status = 'new';
