-- Migration 006: Create orders and order_items tables
-- Fecha: 2026-02-19
-- Descripcion: Historial de compras (ordenes de venta + detalle de productos)
--
-- QUE SON ESTAS TABLAS:
-- El corazon de PymePilot. Sin historial de compras, no hay predicciones.
--
-- orders: La "cabecera" de cada compra (quien compro, cuando, cuanto total)
-- order_items: El "detalle" de cada compra (que productos compro y cuantos)
--
-- Ejemplo:
--   orders: "Celulares Martinez compro el 15/01/2026 por $150.000"
--   order_items: "50x Funda MagSafe a $2.000 + 30x Protector pantalla a $500"
--
-- Esta separacion (cabecera + detalle) es un patron muy comun en bases de datos.
-- Permite saber tanto "cuanto compro" como "que compro exactamente".

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Identificador externo (del ERP)
    external_id TEXT,                           -- Numero de factura/orden en el ERP

    -- Datos de la orden
    order_date DATE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT unique_order_external_id_per_tenant UNIQUE (tenant_id, external_id),
    CONSTRAINT valid_order_amount CHECK (total_amount >= 0),
    CONSTRAINT valid_order_status CHECK (
        status IN ('pending', 'completed', 'cancelled')
    )
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,

    -- Datos del item
    product_name TEXT NOT NULL,                 -- Nombre del producto (copiado para historial)
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_quantity CHECK (quantity > 0),
    CONSTRAINT valid_unit_price CHECK (unit_price >= 0),
    CONSTRAINT valid_total_price CHECK (total_price >= 0)
);

-- Indexes para orders
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_customer_id ON orders(tenant_id, customer_id);
CREATE INDEX idx_orders_date ON orders(tenant_id, order_date);
CREATE INDEX idx_orders_external_id ON orders(tenant_id, external_id);

-- Indexes para order_items
CREATE INDEX idx_order_items_tenant_id ON order_items(tenant_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(tenant_id, product_id);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY order_items_tenant_isolation ON order_items
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE orders IS 'Cabecera de ordenes de venta. Sincronizadas desde el ERP.';
COMMENT ON TABLE order_items IS 'Detalle de productos por orden. product_name se copia para preservar historial si el producto se elimina.';
