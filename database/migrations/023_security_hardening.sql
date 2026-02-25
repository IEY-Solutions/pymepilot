-- =============================================================================
-- MIGRACION 023: Security hardening — revocar permisos excesivos
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- 1. Revoca ALTER DEFAULT PRIVILEGES de migracion 012 (H-02)
-- 2. Restringe UPDATE en predictions a solo 3 columnas (M-02)
-- 3. Revoca INSERT/UPDATE en tenants para pymepilot_app (M-03)
--
-- POR QUE:
-- 1. DEFAULT PRIVILEGES: La migracion 012 otorgaba SELECT+INSERT+UPDATE
--    automaticamente a pymepilot_app en TODA tabla futura creada en
--    schema public. Esto incluye tablas de N8N, GoTrue, o cualquier
--    servicio que comparta orion_db. Desde la migracion 016, los grants
--    se hacen tabla por tabla (correcto), pero el default de 012 seguia
--    activo como "puerta trasera" silenciosa.
--
-- 2. UPDATE predictions: El dashboard solo necesita modificar status,
--    contacted_at, y updated_at (marcar contactado/ignorado). El GRANT
--    original daba UPDATE en TODAS las columnas, permitiendo que un
--    cliente comprometido modifique confidence_score, priority, o
--    message_text — corrompiendo la inteligencia de negocio.
--
-- 3. tenants: pymepilot_app solo necesita SELECT (leer slug → uuid).
--    Con DEFAULT PRIVILEGES de 012, tambien tenia INSERT+UPDATE
--    heredados. Con 2+ tenants, eso seria un riesgo.
--
-- CONCEPTO CLAVE - Principio de minimo privilegio:
-- Cada rol solo tiene los permisos que estrictamente necesita para
-- cumplir su funcion. Es como dar llaves especificas para cada puerta
-- en vez de una llave maestra que abre todo el edificio.
-- =============================================================================

BEGIN;

-- 1. Revocar DEFAULT PRIVILEGES de migracion 012
-- Esto NO quita los permisos ya otorgados a tablas existentes
-- (esos estan controlados por GRANTs explicitos en 016/017/018/019).
-- Solo evita que tablas FUTURAS reciban permisos automaticos.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT, INSERT, UPDATE ON TABLES FROM pymepilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE USAGE ON SEQUENCES FROM pymepilot_app;

-- 2. Restringir UPDATE en predictions a columnas especificas
-- Primero revocar el UPDATE general, luego otorgar por columna.
REVOKE UPDATE ON predictions FROM authenticated;
GRANT UPDATE (status, contacted_at, updated_at) ON predictions TO authenticated;

-- 3. Revocar INSERT/UPDATE en tenants para pymepilot_app
-- pymepilot_app solo necesita SELECT para resolver slug → uuid.
-- Los permisos extra venian de DEFAULT PRIVILEGES + GRANT ALL de 012.
REVOKE INSERT, UPDATE, DELETE ON tenants FROM pymepilot_app;

COMMIT;
