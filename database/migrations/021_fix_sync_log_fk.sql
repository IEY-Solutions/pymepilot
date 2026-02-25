-- =============================================================================
-- MIGRACION 021: FK sync_log_id → ON DELETE SET NULL + index
-- =============================================================================
-- EJECUTAR CONTRA: orion_db
--
-- QUE HACE:
-- 1. Cambia FK upload_jobs.sync_log_id de NO ACTION a ON DELETE SET NULL
-- 2. Agrega index en sync_log_id para performance de la FK
--
-- POR QUE:
-- 1. FK SET NULL: La migracion 020 corrigio las 4 FK a tenants(id) pero
--    olvido la FK a sync_log(id). Con NO ACTION (default), si se borra
--    un registro de sync_log que tiene upload_jobs asociados, PostgreSQL
--    bloquea la operacion. Con SET NULL, el upload_job se mantiene pero
--    pierde la referencia al sync_log (que es aceptable — el upload_job
--    tiene valor historico independiente del sync_log).
--
-- 2. Index: PostgreSQL NO crea automaticamente un index en la columna
--    hija de una FK (a diferencia de MySQL). Sin index, cada DELETE o
--    UPDATE del PK de sync_log causa un sequential scan en upload_jobs.
--    Es como buscar un nombre en un libro sin indice — hay que leer
--    pagina por pagina.
--
-- CONCEPTO CLAVE - SET NULL vs CASCADE:
-- CASCADE borra los hijos cuando se borra el padre. SET NULL les pone
-- NULL en la columna de referencia. Aca usamos SET NULL porque:
-- - El upload_job registra "se subio un archivo" (auditoria)
-- - El sync_log registra "se sincronizaron datos" (resultado)
-- - Si se borra el resultado, el registro de subida sigue siendo valido
-- =============================================================================

BEGIN;

-- 1. Cambiar FK de NO ACTION a SET NULL
ALTER TABLE public.upload_jobs
    DROP CONSTRAINT upload_jobs_sync_log_id_fkey,
    ADD CONSTRAINT upload_jobs_sync_log_id_fkey
        FOREIGN KEY (sync_log_id) REFERENCES sync_log(id) ON DELETE SET NULL;

-- 2. Index parcial (solo filas con sync_log_id no NULL)
-- Evita indexar filas que todavia no tienen sync_log asociado
CREATE INDEX IF NOT EXISTS idx_upload_jobs_sync_log
    ON public.upload_jobs (sync_log_id)
    WHERE sync_log_id IS NOT NULL;

COMMIT;
