-- Migration 009: Create additional performance indexes
-- Fecha: 2026-02-19
-- Descripcion: Indexes compuestos para las queries mas frecuentes del motor
--
-- QUE SON LOS INDEXES:
-- Imagina una base de datos como un libro de 1000 paginas.
-- Sin index: para buscar algo, tenés que leer las 1000 paginas (lento).
-- Con index: es como tener el indice al final del libro, que te dice
--            "frecuencia de compra, ver pagina 547" (rapido).
--
-- Los indexes ocupan espacio extra en disco, pero aceleran enormemente las busquedas.
-- Solo creamos indexes en columnas que usamos frecuentemente en WHERE, JOIN, ORDER BY.

-- Para el motor de Reposicion (V2): buscar ordenes recientes por cliente
CREATE INDEX IF NOT EXISTS idx_orders_customer_date
    ON orders(customer_id, order_date DESC);

-- Para calcular frecuencia: items por producto por cliente
CREATE INDEX IF NOT EXISTS idx_order_items_product_customer
    ON order_items(product_id, order_id);

-- Para el dashboard: predicciones pendientes por vertical y fecha
CREATE INDEX IF NOT EXISTS idx_predictions_dashboard
    ON predictions(tenant_id, vertical, status, prediction_date DESC)
    WHERE status IN ('pending', 'contacted');

-- Para el sync: ultima sincronizacion exitosa por tenant
CREATE INDEX IF NOT EXISTS idx_sync_log_last_success
    ON sync_log(tenant_id, completed_at DESC)
    WHERE status = 'completed';

-- Para buscar clientes por fecha de ultima compra (V4: inactivos)
CREATE INDEX IF NOT EXISTS idx_customers_inactivity
    ON customers(tenant_id, last_purchase_date)
    WHERE status = 'active';

-- Para buscar clientes nuevos (V1: activacion)
CREATE INDEX IF NOT EXISTS idx_customers_new
    ON customers(tenant_id, first_purchase_date DESC)
    WHERE status = 'new';
