-- Migration 004: Create customers table
-- Fecha: 2026-02-19
-- Descripcion: Clientes de cada distribuidor (los clientes de IEY, por ejemplo)
--
-- QUE ES ESTA TABLA:
-- Aca guardamos los clientes del distribuidor (no los usuarios de PymePilot).
-- Ejemplo: Si IEY vende a "Celulares Martinez", Martinez es un customer de IEY.
-- Los datos se sincronizan automaticamente desde el ERP del distribuidor.
--
-- external_id: Es el ID que tiene este cliente en el ERP del distribuidor.
-- Lo guardamos para poder hacer "matching" cuando sincronizamos datos nuevos.

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identificador externo (del ERP)
    external_id TEXT,                           -- ID en Contabilium, Xubio, etc.

    -- Datos del cliente
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    notes TEXT,

    -- Campos calculados (se actualizan en cada sync)
    first_purchase_date DATE,                   -- Fecha de su primera compra
    last_purchase_date DATE,                    -- Fecha de su ultima compra
    total_purchases_count INTEGER NOT NULL DEFAULT 0,   -- Cuantas compras hizo
    total_purchases_amount DECIMAL(12,2) NOT NULL DEFAULT 0, -- Cuanto gasto en total
    avg_days_between_purchases DECIMAL(8,2),    -- Promedio de dias entre compras
    status TEXT NOT NULL DEFAULT 'active',       -- active, inactive, new, lost

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT unique_external_id_per_tenant UNIQUE (tenant_id, external_id),
    CONSTRAINT valid_customer_status CHECK (
        status IN ('new', 'active', 'inactive', 'lost')
    ),
    CONSTRAINT valid_purchase_count CHECK (total_purchases_count >= 0),
    CONSTRAINT valid_purchase_amount CHECK (total_purchases_amount >= 0)
);

-- Indexes
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_external_id ON customers(tenant_id, external_id);
CREATE INDEX idx_customers_status ON customers(tenant_id, status);
CREATE INDEX idx_customers_last_purchase ON customers(tenant_id, last_purchase_date);

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_tenant_isolation ON customers
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE customers IS 'Clientes de cada distribuidor. Sincronizados desde el ERP.';
COMMENT ON COLUMN customers.external_id IS 'ID del cliente en el sistema ERP del distribuidor (para matching en sync)';
COMMENT ON COLUMN customers.avg_days_between_purchases IS 'Promedio calculado de dias entre compras. Base para predicciones de V2.';
