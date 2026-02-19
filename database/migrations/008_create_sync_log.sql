-- Migration 008: Create sync_log table
-- Fecha: 2026-02-19
-- Descripcion: Registro de cada sincronizacion con el ERP
--
-- QUE ES ESTA TABLA:
-- Cada vez que PymePilot se conecta al ERP del distribuidor para traer datos nuevos,
-- queda registrado aca: cuando fue, cuantos registros trajo, si funciono o fallo.
--
-- Es como el "cuaderno de bitacora" de las sincronizaciones.
-- Si algo falla, podemos ver exactamente que paso y cuando.

CREATE TABLE IF NOT EXISTS sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tipo de sync
    sync_type TEXT NOT NULL,                    -- 'full' (todo desde cero) o 'incremental' (solo lo nuevo)
    source TEXT NOT NULL,                       -- 'contabilium', 'excel', 'xubio', etc.

    -- Estado
    status TEXT NOT NULL DEFAULT 'started',     -- started, completed, failed

    -- Metricas
    customers_synced INTEGER NOT NULL DEFAULT 0,
    products_synced INTEGER NOT NULL DEFAULT 0,
    orders_synced INTEGER NOT NULL DEFAULT 0,

    -- Errores
    error_message TEXT,                         -- Mensaje de error si fallo
    error_details JSONB,                        -- Detalles tecnicos del error

    -- Tiempos
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Validaciones
    CONSTRAINT valid_sync_type CHECK (sync_type IN ('full', 'incremental')),
    CONSTRAINT valid_sync_status CHECK (status IN ('started', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_sync_log_tenant_id ON sync_log(tenant_id);
CREATE INDEX idx_sync_log_status ON sync_log(tenant_id, status);
CREATE INDEX idx_sync_log_started_at ON sync_log(tenant_id, started_at);

-- RLS
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_log_tenant_isolation ON sync_log
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE sync_log IS 'Bitacora de sincronizaciones ERP. Cada fila = un intento de sync (exitoso o fallido).';
