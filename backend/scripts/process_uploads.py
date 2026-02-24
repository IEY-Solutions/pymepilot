#!/usr/bin/env python3
"""
Worker para procesar archivos subidos via Smart File Upload (Canal 2).

QUE HACE ESTE SCRIPT:
Se ejecuta cada 1 minuto via cron. Busca upload_jobs con status='pending',
toma el primero (con FOR UPDATE SKIP LOCKED para evitar duplicados),
descarga los archivos de Supabase Storage, los analiza con Claude para
detectar el formato, y ejecuta SyncEngine con el SmartFileConnector.

CONCEPTO CLAVE - Cola de trabajo (Job Queue):
La tabla upload_jobs funciona como una cola. El frontend pone "tickets"
(jobs) en la cola, y este worker los toma y procesa uno por uno.
FOR UPDATE SKIP LOCKED significa: "dame el primer ticket que no este
siendo procesado por otro worker". Es como hacer fila en un banco
con un sistema de turnos.

CONCEPTO CLAVE - Idempotencia:
Si el worker se ejecuta y no hay jobs pendientes, no hace nada.
Si ya hay otro worker procesando un job, este lo salta.
Si el worker muere a mitad de proceso, el job queda en 'processing'
y un timeout (10 min) lo marca como 'failed'.

USO:
    python backend/scripts/process_uploads.py                  # Procesa 1 job pendiente
    python backend/scripts/process_uploads.py --timeout-check  # Marca jobs stale como failed

CRON (cada 1 minuto):
    * * * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/process_uploads.py >> /home/pato/logs/upload-worker.log 2>&1
"""

import argparse
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

# Entry point boilerplate (mismo patron que sync_erp.py)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

os.umask(0o077)  # Archivos temporales solo legibles por el owner

from backend.config.settings import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from backend.engine.connectors.smart import SmartFileConnector
from backend.engine.connectors.sync import SyncEngine
from backend.engine.core.logger import get_logger, sanitize_text
from backend.engine.db.connection import get_db_connection, get_db_connection_no_tenant, close_pool

logger = get_logger(__name__)

# Timeout: si un job lleva mas de 10 minutos en 'processing', marcarlo como failed
STALE_JOB_TIMEOUT_MINUTES = 10


def process_one_job() -> bool:
    """Toma y procesa un job pendiente.

    Returns:
        True si proceso un job, False si no habia ninguno pendiente.
    """
    # Validar configuracion necesaria
    if not SUPABASE_URL:
        logger.error("SUPABASE_URL no configurada en .env")
        return False
    if not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("SUPABASE_SERVICE_ROLE_KEY no configurada en .env")
        return False

    # 1. Buscar job pendiente (SIN tenant context — necesitamos ver todos)
    job = None
    with get_db_connection_no_tenant() as conn:
        row = conn.execute(
            """
            SELECT id, tenant_id, file_paths, total_size_bytes
            FROM upload_jobs
            WHERE status = 'pending'
            ORDER BY created_at
            LIMIT 1
            FOR UPDATE SKIP LOCKED
            """,
        ).fetchone()

        if row is None:
            return False  # No hay jobs pendientes

        job_id, tenant_id, file_paths_json, total_size = row
        job = {
            "id": job_id,
            "tenant_id": str(tenant_id),
            "file_paths": file_paths_json,  # Ya es dict/list (JSONB)
            "total_size": total_size,
        }

        # Marcar como processing
        conn.execute(
            """
            UPDATE upload_jobs
            SET status = 'processing', started_at = NOW()
            WHERE id = %s
            """,
            (job_id,),
        )
        conn.commit()

    logger.info(
        f"Job tomado: id={job['id']}, tenant={job['tenant_id']}, "
        f"archivos={len(job['file_paths'])}, size={job['total_size']}B"
    )

    # 2. Descargar archivos de Storage y procesar
    temp_dir = None
    try:
        temp_dir = tempfile.mkdtemp(prefix="pymepilot_upload_")
        local_paths = []

        for file_info in job["file_paths"]:
            storage_path = file_info["path"]
            file_name = file_info["name"]
            local_path = os.path.join(temp_dir, file_name)

            _download_from_storage(storage_path, local_path)
            local_paths.append(local_path)

        logger.info(f"Archivos descargados: {len(local_paths)}")

        # 3. Analizar con Claude
        mapping = SmartFileConnector.analyze_files(local_paths)

        # Guardar mapping para auditoria
        with get_db_connection_no_tenant() as conn:
            conn.execute(
                "UPDATE upload_jobs SET column_mapping = %s WHERE id = %s",
                (json.dumps(mapping), job["id"]),
            )
            conn.commit()

        # 4. Crear SmartFileConnector y ejecutar SyncEngine
        connector = SmartFileConnector(local_paths, mapping)

        # Buscar el slug del tenant para SyncEngine
        with get_db_connection_no_tenant() as conn:
            slug_row = conn.execute(
                "SELECT slug FROM tenants WHERE id = %s",
                (job["tenant_id"],),
            ).fetchone()

        if not slug_row:
            raise ValueError(f"Tenant {job['tenant_id']} no encontrado")

        tenant_slug = slug_row[0]

        engine = SyncEngine()
        engine.run(
            tenant_slug=tenant_slug,
            connector_override=connector,
            source_override="upload",
        )

        # 5. Obtener sync_log_id (el mas reciente del tenant con source='upload')
        with get_db_connection(job["tenant_id"]) as conn:
            sync_row = conn.execute(
                """
                SELECT id FROM sync_log
                WHERE tenant_id = %s AND source = 'upload'
                ORDER BY started_at DESC LIMIT 1
                """,
                (job["tenant_id"],),
            ).fetchone()
            sync_log_id = sync_row[0] if sync_row else None

        # 6. Marcar como completed
        with get_db_connection_no_tenant() as conn:
            conn.execute(
                """
                UPDATE upload_jobs
                SET status = 'completed', sync_log_id = %s, completed_at = NOW()
                WHERE id = %s
                """,
                (sync_log_id, job["id"]),
            )
            conn.commit()

        logger.info(f"Job completado: id={job['id']}, sync_log={sync_log_id}")
        return True

    except Exception as exc:
        # Marcar como failed con mensaje de error sanitizado
        error_msg = sanitize_text(str(exc))[:500]  # Truncar a 500 chars
        logger.error(f"Job fallido: id={job['id']}, error={error_msg}")

        try:
            with get_db_connection_no_tenant() as conn:
                conn.execute(
                    """
                    UPDATE upload_jobs
                    SET status = 'failed', error_message = %s, completed_at = NOW()
                    WHERE id = %s
                    """,
                    (error_msg, job["id"]),
                )
                conn.commit()
        except Exception as db_exc:
            logger.critical(f"No se pudo marcar job como failed: {db_exc}")

        return True  # Procesamos un job (aunque fallo)

    finally:
        # Limpiar archivos temporales
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass


def check_stale_jobs() -> None:
    """Marca jobs que llevan mas de STALE_JOB_TIMEOUT_MINUTES en 'processing'.

    Si un worker muere a mitad de proceso (OOM kill, crash, etc.), el job
    queda en 'processing' para siempre. Este check lo marca como 'failed'
    para que el usuario sepa que algo paso.
    """
    with get_db_connection_no_tenant() as conn:
        result = conn.execute(
            """
            UPDATE upload_jobs
            SET status = 'failed',
                error_message = 'Timeout: el procesamiento tardo demasiado. Intenta subir de nuevo.',
                completed_at = NOW()
            WHERE status = 'processing'
              AND started_at < NOW() - INTERVAL '%s minutes'
            RETURNING id
            """,
            (STALE_JOB_TIMEOUT_MINUTES,),
        ).fetchall()

        if result:
            conn.commit()
            for row in result:
                logger.warning(f"Job stale marcado como failed: id={row[0]}")


def _download_from_storage(storage_path: str, local_path: str) -> None:
    """Descarga un archivo de Supabase Storage usando SERVICE_ROLE_KEY.

    QUE HACE: HTTP GET al endpoint de Storage con auth de service role.
    La SERVICE_ROLE_KEY bypassa RLS — es el equivalente a "admin" de Storage.
    Solo se usa en el worker server-side, NUNCA en el frontend.

    SEGURIDAD: El archivo se guarda en /tmp/ con umask 0o077 (solo el owner
    puede leer). Se elimina en el bloque finally del caller.
    """
    # URL del endpoint de Storage
    # Formato: {SUPABASE_URL}/storage/v1/object/data-uploads/{path}
    url = f"{SUPABASE_URL}/storage/v1/object/data-uploads/{storage_path}"

    req = Request(url)
    req.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_ROLE_KEY}")
    req.add_header("apikey", SUPABASE_SERVICE_ROLE_KEY)

    try:
        with urlopen(req, timeout=60) as response:
            with open(local_path, "wb") as f:
                f.write(response.read())
    except URLError as exc:
        raise ConnectionError(
            f"No se pudo descargar archivo de Storage: {storage_path}"
        ) from exc

    logger.info(f"Descargado: {storage_path} → {local_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Worker para procesar uploads de Smart File Upload"
    )
    parser.add_argument(
        "--timeout-check",
        action="store_true",
        help="Solo verificar y marcar jobs stale como failed (no procesar nuevos)",
    )

    args = parser.parse_args()

    try:
        if args.timeout_check:
            check_stale_jobs()
        else:
            # Siempre verificar stale jobs primero
            check_stale_jobs()
            # Luego procesar 1 job pendiente
            processed = process_one_job()
            if not processed:
                # No logueamos nada si no hay jobs — el cron corre cada minuto
                # y no queremos llenar el log con "no hay jobs" 1440 veces/dia
                pass
    finally:
        close_pool()


if __name__ == "__main__":
    main()
