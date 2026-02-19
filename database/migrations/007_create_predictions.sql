-- Migration 007: Create predictions table
-- Fecha: 2026-02-19
-- Descripcion: Predicciones generadas por el motor inteligente
--
-- QUE ES ESTA TABLA:
-- Aca se guardan las "recomendaciones" que genera el motor cada manana.
-- Cada fila es: "contacta a este cliente, ofrecele esto, con esta confianza"
--
-- Ejemplo de una prediccion:
--   vertical: 'reposicion'
--   customer: "Celulares Martinez"
--   message_text: "Hola Juan! Hace 23 dias que no compras fundas MagSafe..."
--   confidence_score: 0.85 (85% de confianza)
--   priority: 1 (alta)
--   status: 'pending' (todavia no lo contactaron)
--
-- El vendedor ve esto en el dashboard y decide si contactar o no.

CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Tipo de prediccion
    vertical TEXT NOT NULL,                     -- 'reposicion', 'activacion', 'cross_sell', 'recuperacion'

    -- Fechas
    prediction_date DATE NOT NULL,              -- Cuando se genero
    contact_date DATE,                          -- Fecha recomendada para contactar
    contacted_at TIMESTAMPTZ,                   -- Cuando realmente se contacto

    -- Contenido
    message_text TEXT,                          -- Mensaje sugerido para WhatsApp
    suggested_products JSONB DEFAULT '[]',      -- Productos sugeridos [{"name": "...", "qty": 10}]

    -- Scoring
    confidence_score DECIMAL(3,2),              -- 0.00 a 1.00 (que tan seguro estamos)
    priority INTEGER NOT NULL DEFAULT 3,        -- 1 (urgente) a 5 (baja)

    -- Estado
    status TEXT NOT NULL DEFAULT 'pending',     -- pending, contacted, ignored, completed

    -- Metadata (datos extra flexibles por vertical)
    metadata JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_vertical CHECK (
        vertical IN ('reposicion', 'activacion', 'cross_sell', 'recuperacion')
    ),
    CONSTRAINT valid_confidence CHECK (
        confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
    ),
    CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 5),
    CONSTRAINT valid_prediction_status CHECK (
        status IN ('pending', 'contacted', 'ignored', 'completed', 'expired')
    )
);

-- Indexes
CREATE INDEX idx_predictions_tenant_id ON predictions(tenant_id);
CREATE INDEX idx_predictions_customer_id ON predictions(tenant_id, customer_id);
CREATE INDEX idx_predictions_vertical ON predictions(tenant_id, vertical);
CREATE INDEX idx_predictions_status ON predictions(tenant_id, status);
CREATE INDEX idx_predictions_date ON predictions(tenant_id, prediction_date);
-- Index compuesto para la query mas comun: "predicciones pendientes de hoy por tenant"
CREATE INDEX idx_predictions_pending_today ON predictions(tenant_id, status, prediction_date)
    WHERE status = 'pending';

-- RLS
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY predictions_tenant_isolation ON predictions
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE predictions IS 'Predicciones generadas por el motor. Cada fila es una accion sugerida para el equipo comercial.';
COMMENT ON COLUMN predictions.confidence_score IS 'Score 0-1 basado en regularidad del patron de compra y cantidad de datos disponibles';
COMMENT ON COLUMN predictions.suggested_products IS 'Array JSON de productos sugeridos con cantidades estimadas';
