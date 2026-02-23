-- =============================================================================
-- MIGRACION 016: Consolidar tablas PymePilot en orion_db
-- =============================================================================
-- EJECUTAR CONTRA: orion_db (NO postgres)
-- PROPOSITO: PostgREST y GoTrue apuntan a orion_db, asi que las tablas deben
--            estar ahi para que el dashboard pueda accederlas.
-- PRE-REQUISITO: Backup manual ejecutado
-- =============================================================================

BEGIN;

-- =============================================
-- 1. EXTENSIONES
-- =============================================
-- uuid-ossp: genera UUIDs (gen_random_uuid). Necesario para PRIMARY KEYs.
-- pgcrypto: funciones criptograficas. Necesario para encrypt/decrypt credenciales ERP.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 2. TABLAS (en orden de dependencias FK)
-- =============================================

-- 2a. TENANTS - tabla raiz, todos los demas dependen de ella
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    erp_type TEXT CHECK (erp_type IN ('contabilium', 'excel', 'xubio', 'alegra', 'colppy', 'custom')),
    erp_config JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' OR length(slug) = 1)
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants (active) WHERE active = true;

-- 2b. USER_PROFILES - perfiles de usuarios del dashboard
-- Sin FK explicito a auth.users (convencion Supabase, evita acoplamiento)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'vendedor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_role CHECK (role IN ('super_admin', 'admin', 'vendedor', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles (tenant_id);

-- 2c. CUSTOMERS - clientes del distribuidor
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    notes TEXT,
    first_purchase_date DATE,
    last_purchase_date DATE,
    total_purchases_count INTEGER NOT NULL DEFAULT 0,
    total_purchases_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    avg_days_between_purchases DECIMAL(8,2),
    stddev_days_between_purchases NUMERIC(8,2),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_external_id_per_tenant UNIQUE (tenant_id, external_id),
    CONSTRAINT valid_customer_status CHECK (status IN ('new', 'active', 'inactive', 'lost')),
    CONSTRAINT valid_purchase_count CHECK (total_purchases_count >= 0),
    CONSTRAINT valid_purchase_amount CHECK (total_purchases_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_external_id ON customers (tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_last_purchase ON customers (tenant_id, last_purchase_date);
CREATE INDEX IF NOT EXISTS idx_customers_inactivity ON customers (tenant_id, last_purchase_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_customers_new ON customers (tenant_id, first_purchase_date DESC) WHERE status = 'new';

-- 2d. PRODUCTS - productos del catalogo
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id TEXT,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    subcategory TEXT,
    price DECIMAL(12,2),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_product_external_id_per_tenant UNIQUE (tenant_id, external_id),
    CONSTRAINT valid_price CHECK (price IS NULL OR price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (tenant_id, active) WHERE active = true;

-- 2e. ORDERS - pedidos/ventas
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    external_id TEXT,
    order_date DATE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_order_external_id_per_tenant UNIQUE (tenant_id, external_id),
    CONSTRAINT valid_order_amount CHECK (total_amount >= 0),
    CONSTRAINT valid_order_status CHECK (status IN ('pending', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (tenant_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders (tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders (customer_id, order_date DESC);

-- 2f. ORDER_ITEMS - items de cada pedido
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_quantity CHECK (quantity > 0),
    CONSTRAINT valid_unit_price CHECK (unit_price >= 0),
    CONSTRAINT valid_total_price CHECK (total_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON order_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_customer ON order_items (product_id, order_id);

-- 2g. PREDICTIONS - predicciones del motor IA
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    prediction_date DATE NOT NULL,
    contact_date DATE,
    contacted_at TIMESTAMPTZ,
    message_text TEXT,
    suggested_products JSONB DEFAULT '[]',
    confidence_score DECIMAL(3,2),
    priority INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_vertical CHECK (vertical IN ('reposicion', 'activacion', 'cross_sell', 'recuperacion')),
    CONSTRAINT valid_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 5),
    CONSTRAINT valid_prediction_status CHECK (status IN ('pending', 'contacted', 'ignored', 'completed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_predictions_tenant_id ON predictions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_predictions_customer_id ON predictions (customer_id);
CREATE INDEX IF NOT EXISTS idx_predictions_vertical ON predictions (tenant_id, vertical);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON predictions (tenant_id, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_pending_today ON predictions (tenant_id, status, contact_date)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_predictions_dashboard ON predictions (tenant_id, vertical, status, prediction_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_dedup
    ON predictions (tenant_id, customer_id, vertical, prediction_date)
    WHERE status IN ('pending', 'contacted');

-- 2h. SYNC_LOG - registro de sincronizaciones
CREATE TABLE IF NOT EXISTS sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started',
    customers_synced INTEGER NOT NULL DEFAULT 0,
    products_synced INTEGER NOT NULL DEFAULT 0,
    orders_synced INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT valid_sync_type CHECK (sync_type IN ('full', 'incremental', 'limited')),
    CONSTRAINT valid_sync_status CHECK (status IN ('started', 'completed', 'failed', 'requires_review'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_tenant_id ON sync_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log (status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_last_success ON sync_log (tenant_id, started_at DESC)
    WHERE status = 'completed';

-- 2i. API_USAGE - registro de consumo Claude API (tabla GLOBAL, sin tenant_id)
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_total INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage (usage_date);

-- =============================================
-- 3. FUNCIONES HELPER
-- =============================================

-- 3a. Trigger para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3b. Setear contexto de tenant (usado por motor Python via psycopg3)
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- 3c. Obtener tenant_id por slug (usado por scripts CLI)
CREATE OR REPLACE FUNCTION get_tenant_id_by_slug(p_slug TEXT)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_slug AND active = true;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant con slug "%" no encontrado o inactivo', p_slug;
    END IF;
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. TRIGGERS updated_at
-- =============================================
DROP TRIGGER IF EXISTS set_updated_at ON tenants;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON user_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON customers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON predictions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON predictions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================
-- 5. RLS BASICO (policies se actualizan en 017 con dual-mode)
-- =============================================
-- Habilitar RLS en tablas con tenant_id (excepto tenants y api_usage)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Policies temporales para que pymepilot_app funcione (017 las reemplaza)
CREATE POLICY tenants_read_all ON tenants FOR SELECT USING (true);

CREATE POLICY user_profiles_tenant_isolation ON user_profiles
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY customers_tenant_isolation ON customers
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY products_tenant_isolation ON products
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY orders_tenant_isolation ON orders
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY order_items_tenant_isolation ON order_items
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY predictions_tenant_isolation ON predictions
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY sync_log_tenant_isolation ON sync_log
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- =============================================
-- 6. FORCE RLS + PERMISOS pymepilot_app
-- =============================================
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE predictions FORCE ROW LEVEL SECURITY;
ALTER TABLE sync_log FORCE ROW LEVEL SECURITY;

-- Permisos para pymepilot_app (motor Python)
GRANT USAGE ON SCHEMA public TO pymepilot_app;
GRANT SELECT ON tenants TO pymepilot_app;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO pymepilot_app;
GRANT SELECT, INSERT, UPDATE ON customers TO pymepilot_app;
GRANT SELECT, INSERT, UPDATE ON products TO pymepilot_app;
GRANT SELECT, INSERT, UPDATE ON orders TO pymepilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO pymepilot_app;
GRANT SELECT, INSERT, UPDATE ON predictions TO pymepilot_app;
GRANT SELECT, INSERT, UPDATE ON sync_log TO pymepilot_app;
GRANT SELECT, INSERT ON api_usage TO pymepilot_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pymepilot_app;

-- Ejecutar helper functions como pymepilot_app
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO pymepilot_app;
GRANT EXECUTE ON FUNCTION get_tenant_id_by_slug(TEXT) TO pymepilot_app;

COMMIT;
