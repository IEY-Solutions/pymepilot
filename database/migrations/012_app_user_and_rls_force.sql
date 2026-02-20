-- Migration 012: Create app user with RLS enforcement + drop sku UNIQUE
-- Fecha: 2026-02-20
-- Descripcion: Seguridad multi-tenant real (no solo nominal)
--
-- POR QUE ESTE CAMBIO ES CRITICO:
-- Hasta ahora, la app se conecta como 'postgres' (superuser).
-- Los superusers IGNORAN las RLS policies automaticamente.
-- Eso significa que todo el aislamiento multi-tenant era una ilusion:
-- las policies existian pero nunca se evaluaban.
--
-- Con pymepilot_app (usuario NO superuser) + FORCE ROW LEVEL SECURITY,
-- el aislamiento es REAL: cada query solo ve datos de su tenant.
--
-- IMPORTANTE: Despues de ejecutar esta migracion, actualizar .env:
--   DATABASE_USER=pymepilot_app
--   DATABASE_PASSWORD=<password generada>

-- ============================================================
-- PARTE 1: Crear usuario de aplicacion
-- ============================================================

-- La password se setea aqui como placeholder.
-- Pato debe cambiarla inmediatamente despues con:
--   ALTER USER pymepilot_app PASSWORD 'nueva_password_segura';
-- y actualizar .env con la nueva password.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pymepilot_app') THEN
        CREATE USER pymepilot_app WITH PASSWORD 'CHANGE_ME_IMMEDIATELY' NOSUPERUSER NOCREATEDB NOCREATEROLE;
        RAISE NOTICE 'Usuario pymepilot_app creado. CAMBIAR PASSWORD INMEDIATAMENTE.';
    ELSE
        RAISE NOTICE 'Usuario pymepilot_app ya existe, saltando creacion.';
    END IF;
END $$;

-- Permisos en schema public
GRANT USAGE ON SCHEMA public TO pymepilot_app;

-- Permisos en tablas existentes (SELECT, INSERT, UPDATE — NO DELETE, NO TRUNCATE)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO pymepilot_app;

-- Permisos en secuencias (necesario para gen_random_uuid y defaults)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pymepilot_app;

-- Permisos para tablas y secuencias FUTURAS (si se crean mas tablas)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO pymepilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO pymepilot_app;

-- ============================================================
-- PARTE 2: FORCE ROW LEVEL SECURITY en todas las tablas con RLS
-- ============================================================
-- Esto fuerza que RLS se aplique incluso para el table owner.
-- Extra defensa: aunque alguien conecte como postgres, RLS filtra.

ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE predictions FORCE ROW LEVEL SECURITY;
ALTER TABLE sync_log FORCE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

-- NOTA: tenants NO tiene RLS (es la tabla maestra, necesita acceso global
-- para funciones como rotate_encryption_key y resolucion slug->id)

-- ============================================================
-- PARTE 3: Quitar UNIQUE constraint en sku de products
-- ============================================================
-- POR QUE: Si Contabilium reasigna un codigo de producto a otro ID,
-- el upsert por external_id fallaria con constraint violation en sku.
-- El external_id (Id de Contabilium) es la fuente de verdad, no el sku.
-- El UNIQUE en (tenant_id, external_id) se mantiene — ese es el correcto.

ALTER TABLE products DROP CONSTRAINT unique_sku_per_tenant;
