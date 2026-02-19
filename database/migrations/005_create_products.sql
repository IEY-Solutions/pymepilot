-- Migration 005: Create products table
-- Fecha: 2026-02-19
-- Descripcion: Catalogo de productos de cada distribuidor
--
-- QUE ES ESTA TABLA:
-- Los productos que vende el distribuidor. Se sincronizan desde el ERP.
-- Ejemplo: "Funda MagSafe iPhone 15" es un producto de IEY.
-- Los usamos para saber QUE recomendar a cada cliente.

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identificador externo (del ERP)
    external_id TEXT,                           -- SKU o ID en el ERP

    -- Datos del producto
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    subcategory TEXT,
    price DECIMAL(12,2),
    active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT unique_product_external_id_per_tenant UNIQUE (tenant_id, external_id),
    CONSTRAINT unique_sku_per_tenant UNIQUE (tenant_id, sku),
    CONSTRAINT valid_price CHECK (price IS NULL OR price >= 0)
);

-- Indexes
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_category ON products(tenant_id, category);
CREATE INDEX idx_products_active ON products(tenant_id, active) WHERE active = true;

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_tenant_isolation ON products
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE products IS 'Catalogo de productos de cada distribuidor. Sincronizado desde el ERP.';
