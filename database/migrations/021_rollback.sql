-- Rollback migracion 021: Revertir FK SET NULL → NO ACTION + drop index
-- EJECUTAR CONTRA: orion_db

BEGIN;

-- 1. Revertir FK a NO ACTION (default original)
ALTER TABLE public.upload_jobs
    DROP CONSTRAINT upload_jobs_sync_log_id_fkey,
    ADD CONSTRAINT upload_jobs_sync_log_id_fkey
        FOREIGN KEY (sync_log_id) REFERENCES sync_log(id);

-- 2. Borrar index
DROP INDEX IF EXISTS idx_upload_jobs_sync_log;

COMMIT;
