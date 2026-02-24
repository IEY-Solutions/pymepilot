-- =============================================================================
-- MIGRACION 018: Tabla upload_jobs + bucket Storage para Smart File Upload
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- PROPOSITO: Canal 2 de ingesta — permitir que usuarios suban archivos Excel
--            desde el dashboard. upload_jobs actua como cola de trabajo entre
--            el frontend (inserta jobs) y el worker Python (los procesa).
--
-- IMPORTANTE: Esta migracion NO modifica ninguna tabla existente.
--             Solo CREA recursos nuevos: 1 tabla, 1 bucket, policies RLS.
-- =============================================================================

BEGIN;

-- =============================================
-- 1. TABLA upload_jobs (cola de trabajo)
-- =============================================
-- Cada fila representa un upload (1 o mas archivos) de un usuario.
-- El frontend crea la fila con status='pending'.
-- El worker Python la toma, la pone en 'processing', y al terminar
-- la marca como 'completed' o 'failed'.
--
-- CONCEPTO: Es como un ticket de soporte — se crea, se asigna,
-- se resuelve o se marca como fallido. Nunca desaparece.

-- NOTA: schema 'public' explicito porque search_path = 'auth, public' en orion_db
CREATE TABLE IF NOT EXISTS public.upload_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID NOT NULL,
    file_paths      JSONB NOT NULL,         -- array de objetos: [{"path": "...", "name": "...", "size": 123}]
    total_size_bytes BIGINT NOT NULL,       -- suma de todos los archivos
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    column_mapping  JSONB,                  -- mapeo devuelto por Claude (se guarda para debug/auditoria)
    sync_log_id     UUID REFERENCES sync_log(id),   -- link al sync resultante
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,            -- cuando el worker lo tomo
    completed_at    TIMESTAMPTZ
);

-- Index para que el worker encuentre jobs pendientes rapido
-- El worker hace: WHERE status='pending' ORDER BY created_at LIMIT 1
CREATE INDEX idx_upload_jobs_pending ON upload_jobs (created_at)
    WHERE status = 'pending';

-- Index para listar uploads de un tenant (dashboard)
CREATE INDEX idx_upload_jobs_tenant ON upload_jobs (tenant_id, created_at DESC);

-- =============================================
-- 2. RLS EN upload_jobs
-- =============================================
-- Misma estrategia dual-mode de migracion 017:
-- get_current_tenant_id() funciona tanto con JWT (dashboard)
-- como con app.tenant_id (worker Python).

ALTER TABLE upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_jobs FORCE ROW LEVEL SECURITY;

-- Policy: cada tenant solo ve sus propios uploads (dashboard via JWT)
CREATE POLICY upload_jobs_tenant_isolation ON upload_jobs
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- Policy: el worker Python (pymepilot_app) necesita acceso cross-tenant
-- para buscar jobs pendientes de CUALQUIER tenant y actualizarlos.
-- get_db_connection_no_tenant() no setea app.tenant_id, así que
-- get_current_tenant_id() retorna NULL → la policy de arriba bloquea.
-- Esta policy permite al worker ver y modificar todos los jobs.
CREATE POLICY upload_jobs_worker_access ON upload_jobs
    FOR ALL TO pymepilot_app
    USING (true)
    WITH CHECK (true);

-- =============================================
-- 3. GRANTS
-- =============================================
-- authenticated (dashboard users): pueden INSERT (crear job) y SELECT (ver status)
-- NO pueden UPDATE (no pueden cambiar status — eso lo hace el worker)
GRANT SELECT, INSERT ON upload_jobs TO authenticated;

-- pymepilot_app (worker Python): necesita SELECT (buscar pending),
-- UPDATE (cambiar status), e INSERT (por si acaso)
GRANT SELECT, INSERT, UPDATE ON upload_jobs TO pymepilot_app;

-- =============================================
-- 4. BUCKET de Storage: data-uploads
-- =============================================
-- Bucket privado: los archivos NO son accesibles via URL publica.
-- Solo se accede via JWT autenticado o SERVICE_ROLE_KEY.
-- Limite: 10MB, solo .xlsx

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'data-uploads',
    'data-uploads',
    false,                                              -- privado
    10485760,                                           -- 10MB en bytes
    ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 5. RLS en storage.objects para el bucket data-uploads
-- =============================================
-- Cada tenant solo puede subir/leer archivos en su carpeta:
--   data-uploads/{tenant_id}/uploads/...
--
-- path_tokens es un campo GENERATED que contiene el path como array.
-- path_tokens[1] = primer segmento del path = tenant_id
--
-- NOTA: storage.objects ya tiene RLS habilitado por default en Supabase,
-- pero sin policies = nadie puede hacer nada (fail-closed). Bien.

-- Policy INSERT: usuario autenticado sube a su carpeta de tenant
CREATE POLICY upload_insert_own_tenant ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'data-uploads'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

-- Policy SELECT: usuario autenticado lee de su carpeta de tenant
CREATE POLICY upload_select_own_tenant ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'data-uploads'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

-- Policy DELETE: usuario autenticado puede borrar de su carpeta
-- (util para cleanup futuro, no para MVP)
CREATE POLICY upload_delete_own_tenant ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'data-uploads'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

-- =============================================
-- 6. SERVICE_ROLE POLICIES (para worker Python y Storage API)
-- =============================================
-- NOTA: Las migraciones internas de Supabase Storage fallaron al inicializar
-- (rows en storage.migrations fueron insertadas en bulk sin ejecutar SQL real).
-- Como resultado, no se crearon las policies standard de service_role.
-- Las creamos aqui para que el Storage API y el worker funcionen.

-- service_role puede hacer todo en buckets (crear, leer, borrar)
CREATE POLICY service_role_buckets_all ON storage.buckets
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- service_role puede hacer todo en objects (descargar archivos del worker)
CREATE POLICY service_role_objects_all ON storage.objects
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
