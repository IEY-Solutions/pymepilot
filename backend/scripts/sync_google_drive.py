#!/usr/bin/env python3
"""
Script de sincronizacion automatica desde Google Drive (Canal 3).

QUE HACE ESTE SCRIPT:
Se ejecuta diariamente a las 4:30 AM (antes del sync ERP a las 5 AM).
Para cada tenant con una conexion Drive activa:
1. Lista archivos .xlsx en la carpeta compartida
2. Detecta archivos nuevos o modificados (comparando modified_time)
3. Descarga los nuevos a /tmp/
4. Crea un upload_job en la cola (misma que Canal 2)
5. El worker existente (process_uploads.py) los procesa

CONCEPTO CLAVE - Reutilizacion de pipeline:
Drive NO tiene su propio pipeline de importacion. Solo alimenta la misma
cola (upload_jobs) que el Smart File Upload (Canal 2). Es como agregar
una entrada nueva a un edificio — el ascensor (SmartFileConnector +
SyncEngine) es el mismo. Esto ahorra codigo y garantiza consistencia.

CONCEPTO CLAVE - Service Account:
En vez de pedirle al usuario que autorice con OAuth (popup de Google),
usamos un "robot" (Service Account) con su propio email. El usuario
comparte su carpeta con ese email, y el robot puede leer los archivos.
Sin popups, sin tokens que expiran, sin flujo OAuth.

SEGURIDAD:
- Service Account solo tiene permiso de LECTURA en carpetas compartidas
- No puede acceder a carpetas no compartidas explicitamente
- Solo descarga archivos .xlsx (filtro por mimeType)
- Archivos temporales en /tmp/ con umask 0o077, eliminados post-descarga
- Credenciales en archivo JSON (path en .env, NUNCA en DB ni en codigo)

CRON:
    30 4 * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/sync_google_drive.py >> /home/pato/logs/drive-sync.log 2>&1

PREREQUISITO:
    Paso 7 del plan: setup manual en Google Cloud Console.
    Sin esto, el script no tiene credenciales y sale con error.
"""

import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# Entry point boilerplate (mismo patron que process_uploads.py)
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, _project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(_project_root, ".env"))

os.umask(0o077)  # Archivos temporales solo legibles por el owner

from backend.engine.core.env_guard import validate_env, DB_VARS, SUPABASE_VARS
validate_env(DB_VARS + SUPABASE_VARS)

from backend.config.settings import GOOGLE_SERVICE_ACCOUNT_PATH, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from backend.engine.core.logger import get_logger, sanitize_text
from backend.engine.db.connection import get_db_connection_no_tenant, close_pool

logger = get_logger(__name__)

# Limite de archivos por carpeta (evitar sync lento con miles de archivos)
MAX_FILES_PER_FOLDER = 10

# Limite de tamano por archivo (mismo que bucket Storage en migracion 018)
# SEGURIDAD: Sin esto, un archivo de 500MB descargado de Drive puede causar
# OOM kill en el VPS de 12GB, tirando PostgreSQL y todo Docker.
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


def _sanitize_filename(name: str) -> str:
    """Sanitiza nombre de archivo de Drive para uso seguro en filesystem y URLs.

    SEGURIDAD: El nombre del archivo lo controla el usuario que lo sube a Drive.
    Sin sanitizacion, un nombre como '../../etc/passwd.xlsx' causaria path traversal
    en os.path.join(temp_dir, file_name) → escribe fuera de temp_dir.

    Solo permite alfanumericos, guiones, puntos, underscores.
    """
    # os.path.basename quita cualquier componente de ruta (../ etc)
    name = os.path.basename(name)
    # Solo caracteres seguros
    name = re.sub(r'[^\w.\-]', '_', name)
    # No empezar con punto (archivo oculto en Linux)
    if name.startswith('.'):
        name = '_' + name
    return name or 'unnamed.xlsx'


def _get_drive_service():
    """Crea el cliente de Google Drive API con Service Account.

    QUE HACE: Lee el archivo JSON de credenciales del Service Account
    y crea un cliente autenticado para la API de Drive.

    POR QUE: El Service Account es un "usuario robot" que puede
    acceder a carpetas compartidas sin intervencion humana.

    Returns:
        Resource: Cliente de Google Drive API v3

    Raises:
        FileNotFoundError: Si el archivo de credenciales no existe
        ValueError: Si GOOGLE_SERVICE_ACCOUNT_PATH no esta configurado
    """
    if not GOOGLE_SERVICE_ACCOUNT_PATH:
        raise ValueError(
            "GOOGLE_SERVICE_ACCOUNT_PATH no configurado en .env. "
            "Completa el Paso 7 (setup Google Cloud) primero."
        )

    creds_path = Path(GOOGLE_SERVICE_ACCOUNT_PATH)
    if not creds_path.exists():
        raise FileNotFoundError(
            f"Archivo de credenciales no encontrado: {creds_path}. "
            "Descarga el JSON del Service Account y copia al servidor."
        )

    # Imports de Google solo cuando se necesitan (no estan instalados
    # hasta que el usuario complete el setup)
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_file(
        str(creds_path),
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )

    return build("drive", "v3", credentials=credentials)


def _list_xlsx_files(service, folder_id: str, since: datetime | None) -> list[dict]:
    """Lista archivos .xlsx en una carpeta de Drive.

    Args:
        service: Cliente de Google Drive API
        folder_id: ID de la carpeta (extraido del link de Drive)
        since: Solo archivos modificados despues de esta fecha (None = todos)

    Returns:
        Lista de dicts con id, name, modifiedTime de cada archivo
    """
    query_parts = [
        f"'{folder_id}' in parents",
        "mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
        "trashed = false",
    ]

    if since is not None:
        # Formato RFC 3339 que la API de Drive espera
        since_str = since.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        query_parts.append(f"modifiedTime > '{since_str}'")

    query = " and ".join(query_parts)

    results = service.files().list(
        q=query,
        fields="files(id, name, modifiedTime)",
        orderBy="modifiedTime desc",
        pageSize=MAX_FILES_PER_FOLDER,
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()

    return results.get("files", [])


def _download_file(service, file_id: str, local_path: str) -> None:
    """Descarga un archivo de Drive a disco local.

    SEGURIDAD: El archivo se guarda en /tmp/ con umask 0o077
    (solo el owner puede leer). Se elimina en el caller.
    """
    from googleapiclient.http import MediaIoBaseDownload
    import io

    request = service.files().get_media(fileId=file_id)

    with io.FileIO(local_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk(num_retries=3)

    # C-01 FIX: Verificar tamano ANTES de subir a Storage o cargar en RAM.
    # Sin esto, un archivo de 500MB se descarga OK pero al hacer f.read()
    # consume toda la RAM del VPS → OOM kill de Docker containers.
    file_size = os.path.getsize(local_path)
    if file_size > MAX_FILE_SIZE_BYTES:
        os.unlink(local_path)
        raise ValueError(
            f"Archivo demasiado grande ({file_size:,} bytes, "
            f"limite: {MAX_FILE_SIZE_BYTES:,} bytes)"
        )

    logger.info(f"Descargado: {file_id} → {local_path} ({file_size:,} bytes)")


def _upload_to_storage(local_path: str, storage_path: str) -> None:
    """Sube un archivo a Supabase Storage para que el worker lo procese.

    Reutiliza el mismo bucket 'data-uploads' que el Canal 2 (Smart File Upload).
    El worker (process_uploads.py) lo descarga de ahi.
    """
    from urllib.request import Request, urlopen
    from urllib.error import URLError

    url = f"{SUPABASE_URL}/storage/v1/object/data-uploads/{storage_path}"

    with open(local_path, "rb") as f:
        data = f.read()

    req = Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_ROLE_KEY}")
    req.add_header("apikey", SUPABASE_SERVICE_ROLE_KEY)
    req.add_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    req.add_header("x-upsert", "true")

    try:
        with urlopen(req, timeout=120) as response:
            response.read()
    except URLError as exc:
        raise ConnectionError(
            f"No se pudo subir archivo a Storage: {storage_path}"
        ) from exc

    logger.info(f"Subido a Storage: {storage_path}")


def sync_all_connections() -> None:
    """Procesa todas las conexiones Drive activas.

    Para cada tenant con drive_connection activa:
    1. Lista archivos .xlsx nuevos/modificados
    2. Descarga cada uno a /tmp/
    3. Sube a Storage
    4. Crea upload_job en la cola
    5. Actualiza last_synced_at

    CONCEPTO CLAVE - Aislamiento de transacciones (H-02 FIX):
    Cada tenant se procesa en su propia transaccion (conn.transaction()).
    Si tenant A falla, su transaccion se revierte automaticamente
    sin afectar a tenant B. Es como tener cajas registradoras separadas:
    si una se traba, las demas siguen funcionando.
    """
    # M-02 FIX: Validar env vars antes de empezar
    if not SUPABASE_URL:
        logger.error("SUPABASE_URL no configurada en .env — abortando Drive sync")
        return
    if not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("SUPABASE_SERVICE_ROLE_KEY no configurada en .env — abortando Drive sync")
        return

    service = _get_drive_service()

    with get_db_connection_no_tenant() as conn:
        connections = conn.execute(
            """
            SELECT dc.id, dc.tenant_id, dc.folder_id, dc.last_synced_at,
                   t.slug AS tenant_slug
            FROM drive_connections dc
            JOIN tenants t ON t.id = dc.tenant_id
            WHERE dc.status = 'active'
            """,
        ).fetchall()

        # Cerrar la transaccion implicita del SELECT para que cada tenant
        # arranque con una transaccion limpia via conn.transaction()
        conn.commit()

        if not connections:
            logger.info("No hay conexiones Drive activas")
            return

        logger.info(f"Procesando {len(connections)} conexiones Drive")

        for conn_id, tenant_id, folder_id, last_synced_at, tenant_slug in connections:
            try:
                # H-02 FIX: conn.transaction() crea una transaccion aislada.
                # Si falla, hace ROLLBACK automatico → la conexion queda limpia
                # para el siguiente tenant. Sin esto, un error dejaba la conexion
                # en estado INERROR y todos los tenants siguientes fallaban.
                with conn.transaction():
                    _sync_one_connection(
                        conn, service, conn_id, tenant_id, folder_id,
                        last_synced_at, tenant_slug,
                    )
            except Exception as exc:
                # conn.transaction() ya hizo ROLLBACK → conexion limpia
                # H-01 FIX: sanitize_text() limpia tokens, URLs internas, y
                # credenciales que Google API pueda incluir en mensajes de error.
                # Sin esto, esos datos quedaban en la DB y se mostraban en el dashboard.
                error_msg = sanitize_text(str(exc))[:500]
                logger.error(
                    f"Error sync Drive para tenant {tenant_slug}: {error_msg}"
                )
                # P-07 FIX: Envolver el UPDATE en su propio try/except.
                # Si la DB se cayo (ej: PostgreSQL reiniciado), el UPDATE tambien
                # falla. Sin este try/except, esa excepcion mata el loop y todos
                # los tenants restantes se pierden. Con el try/except, se loguea
                # el error y el loop continua con el siguiente tenant.
                try:
                    conn.execute(
                        """
                        UPDATE drive_connections
                        SET status = 'error', error_message = %s
                        WHERE id = %s
                        """,
                        (error_msg, conn_id),
                    )
                    conn.commit()
                except Exception as db_err:
                    logger.critical(
                        f"No se pudo actualizar drive_connection a error: {db_err}"
                    )


def _sync_one_connection(
    conn, service, conn_id, tenant_id, folder_id: str,
    last_synced_at, tenant_slug: str,
) -> None:
    """Sincroniza una conexion Drive individual."""
    # S-01 FIX: Validar formato de folder_id antes de usar en Drive API query.
    # El frontend valida con regex, pero el backend no debe confiar en eso.
    # Un folder_id con comillas simples podria inyectarse en la query de Drive.
    if not re.match(r'^[a-zA-Z0-9_-]+$', folder_id):
        raise ValueError(f"folder_id invalido para tenant {tenant_slug}")

    logger.info(f"Sync Drive: tenant={tenant_slug}, folder={folder_id}")

    # 1. Listar archivos nuevos/modificados
    files = _list_xlsx_files(service, folder_id, last_synced_at)

    if not files:
        logger.info(f"Tenant {tenant_slug}: sin archivos nuevos")
        return

    logger.info(f"Tenant {tenant_slug}: {len(files)} archivos nuevos/modificados")

    # 2. Descargar, subir a Storage, crear upload_job
    temp_dir = tempfile.mkdtemp(prefix="pymepilot_drive_")

    try:
        file_infos = []

        for file_meta in files:
            # M-01 FIX: Sanitizar nombre de archivo de Drive.
            # Sin esto, un nombre como "../../etc/cron.d/malware.xlsx" causaria
            # path traversal en os.path.join() → escribe fuera de temp_dir.
            file_name = _sanitize_filename(file_meta["name"])
            local_path = os.path.join(temp_dir, file_name)

            # Descargar de Drive a /tmp/
            _download_file(service, file_meta["id"], local_path)

            # Subir a Storage (misma ruta que Canal 2)
            storage_path = f"{tenant_id}/drive/{file_name}"
            _upload_to_storage(local_path, storage_path)

            file_infos.append({
                "name": file_name,
                "path": storage_path,
            })

        # 3. Crear upload_job (misma cola que Canal 2)
        total_size = sum(
            os.path.getsize(os.path.join(temp_dir, f["name"]))
            for f in file_infos
        )

        conn.execute(
            """
            INSERT INTO upload_jobs (tenant_id, file_paths, total_size_bytes, status)
            VALUES (%s, %s::jsonb, %s, 'pending')
            """,
            (tenant_id, json.dumps(file_infos), total_size),
        )

        # 4. Actualizar last_synced_at y limpiar error
        conn.execute(
            """
            UPDATE drive_connections
            SET last_synced_at = NOW(), error_message = NULL, status = 'active'
            WHERE id = %s
            """,
            (conn_id,),
        )
        # NOTA: No hacemos conn.commit() aqui — lo maneja conn.transaction()
        # en sync_all_connections(). Si algo falla antes de llegar aca,
        # el rollback automatico deshace TODO (INSERT + UPDATE), no solo parte.

        logger.info(
            f"Tenant {tenant_slug}: upload_job creado con {len(file_infos)} archivos "
            f"({total_size} bytes)"
        )

    finally:
        # Limpiar archivos temporales
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


def main() -> None:
    logger.info("Drive sync: INICIO")
    try:
        sync_all_connections()
    except Exception as exc:
        logger.error(f"Drive sync: ERROR FATAL — {exc}")
    finally:
        close_pool()
        logger.info("Drive sync: FIN")


if __name__ == "__main__":
    main()
