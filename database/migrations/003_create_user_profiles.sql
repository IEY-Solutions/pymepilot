-- Migration 003: Create user_profiles table
-- Fecha: 2026-02-19
-- Descripcion: Perfiles de usuario vinculados a Supabase Auth y a un tenant
--
-- COMO FUNCIONA LA AUTH:
-- Supabase Auth maneja el login (email/password) y guarda usuarios en auth.users
-- Nosotros creamos user_profiles para agregar info extra: a que tenant pertenece
-- y que rol tiene (admin, vendedor, viewer).
-- La FK a auth.users conecta nuestro perfil con el usuario de Supabase.

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,                        -- Mismo ID que auth.users (no generamos uno nuevo)
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'vendedor',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT valid_role CHECK (
        role IN ('super_admin', 'admin', 'vendedor', 'viewer')
    )
);

-- Indexes
CREATE INDEX idx_user_profiles_tenant_id ON user_profiles(tenant_id);

-- RLS: Cada usuario solo ve perfiles de su propio tenant
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_tenant_isolation ON user_profiles
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE user_profiles IS 'Perfiles extendidos de usuario con tenant y rol. El id coincide con auth.users.id';
COMMENT ON COLUMN user_profiles.role IS 'Rol del usuario: super_admin (Pato), admin (dueno distribuidora), vendedor (equipo comercial), viewer (solo lectura)';
