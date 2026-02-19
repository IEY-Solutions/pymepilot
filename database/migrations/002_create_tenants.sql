-- Migration 002: Create tenants table
-- Fecha: 2026-02-19
-- Descripcion: Tabla maestra de tenants (distribuidores/clientes de PymePilot)
--
-- QUE ES UN TENANT:
-- Cada distribuidor que usa PymePilot es un "tenant" (inquilino).
-- Esta tabla es el registro central de todos los distribuidores.
-- Ejemplo: IEY es el primer tenant.

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                         -- Nombre visible: "IEY Distribuidora"
    slug TEXT UNIQUE NOT NULL,                  -- Identificador URL-safe: "iey"
    erp_type TEXT,                              -- Tipo de ERP: 'contabilium', 'excel', 'xubio'
    erp_config JSONB NOT NULL DEFAULT '{}',     -- Config del conector ERP (sin secrets!)
    settings JSONB NOT NULL DEFAULT '{}',       -- Configuracion general del tenant
    active BOOLEAN NOT NULL DEFAULT true,       -- Si el tenant esta activo
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' OR length(slug) = 1),
    CONSTRAINT valid_erp_type CHECK (
        erp_type IS NULL OR erp_type IN ('contabilium', 'excel', 'xubio', 'alegra', 'colppy', 'custom')
    )
);

-- Index en slug (busquedas frecuentes por slug)
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(active) WHERE active = true;

COMMENT ON TABLE tenants IS 'Registro maestro de distribuidores (clientes de PymePilot)';
COMMENT ON COLUMN tenants.erp_type IS 'Tipo de ERP conectado. NULL si no tiene ERP configurado';
COMMENT ON COLUMN tenants.erp_config IS 'Configuracion del conector ERP (endpoint, mapping). NUNCA almacenar secrets aqui';
