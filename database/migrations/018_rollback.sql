-- =============================================================================
-- ROLLBACK 018: Revertir upload_jobs + bucket Storage
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
-- NOTA: Esto elimina la tabla y el bucket. Los archivos en Storage
--       se pierden (pero son copias del Excel del usuario, no datos unicos).
-- =============================================================================

BEGIN;

-- 1. Eliminar policies de storage
DROP POLICY IF EXISTS upload_insert_own_tenant ON storage.objects;
DROP POLICY IF EXISTS upload_select_own_tenant ON storage.objects;
DROP POLICY IF EXISTS upload_delete_own_tenant ON storage.objects;
DROP POLICY IF EXISTS service_role_objects_all ON storage.objects;
DROP POLICY IF EXISTS service_role_buckets_all ON storage.buckets;

-- 2. Eliminar archivos del bucket (si hay)
DELETE FROM storage.objects WHERE bucket_id = 'data-uploads';

-- 3. Eliminar bucket
DELETE FROM storage.buckets WHERE id = 'data-uploads';

-- 4. Eliminar tabla upload_jobs (CASCADE por si tiene FKs futuras)
DROP TABLE IF EXISTS upload_jobs CASCADE;

COMMIT;
