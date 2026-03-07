#!/usr/bin/env python3
"""
Script CLI para sincronizar datos del ERP a PymePilot.

QUE HACE ESTE SCRIPT:
Es el punto de entrada para la sincronizacion. Vos (Pato) ejecutas
este comando en la terminal y se descargan los datos de Contabilium
a la base de datos de PymePilot.

CONCEPTO CLAVE - CLI (Command Line Interface):
argparse convierte los argumentos del comando en variables Python:
  --tenant-slug iey  → args.tenant_slug = 'iey'
  --limit 5          → args.limit = 5
  --test-only        → args.test_only = True

USO:
  python backend/scripts/sync_erp.py --tenant-slug iey                    # Sync full (usa config del tenant)
  python backend/scripts/sync_erp.py --tenant-slug iey --test-only        # Solo test conexion
  python backend/scripts/sync_erp.py --tenant-slug iey --limit 5          # Sync limitado (5 por entidad)
  python backend/scripts/sync_erp.py --tenant-slug iey --since 2026-01-01 # Incremental
  python backend/scripts/sync_erp.py --tenant-slug iey --connector excel --file datos.xlsx  # Excel override

ORDEN DE IMPORTS (obligatorio para entry points):
1. Imports de stdlib
2. load_dotenv() ANTES de imports del proyecto
3. os.umask(0o077) ANTES de crear archivos
4. Imports del proyecto
"""

import argparse
import os
import sys
from datetime import date

# Agregar la raiz del proyecto al path de Python para que encuentre
# el paquete "backend". Sin esto, "from backend.config..." falla.
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, _project_root)

from dotenv import load_dotenv

# load_dotenv con path EXPLICITO (incidente 7 de marzo)
load_dotenv(os.path.join(_project_root, ".env"))

# umask ANTES de crear archivos (logs, etc.)
os.umask(0o077)

from backend.engine.core.env_guard import validate_env, DB_VARS, ERP_VARS
validate_env(DB_VARS + ERP_VARS)

from backend.engine.connectors.sync import SyncEngine
from backend.engine.core.logger import get_logger, sanitize_text

logger = get_logger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Sincronizar datos del ERP a PymePilot'
    )
    parser.add_argument(
        '--tenant-slug',
        type=str,
        required=True,
        help='Slug del tenant (ej: iey)'
    )
    parser.add_argument(
        '--test-only',
        action='store_true',
        help='Solo probar la conexion al ERP (no sincronizar)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limitar a N registros POR ENTIDAD (clientes, productos, ordenes)'
    )
    parser.add_argument(
        '--since',
        type=str,
        default=None,
        help='Sync incremental desde fecha (formato: YYYY-MM-DD). Solo filtra ordenes.'
    )
    parser.add_argument(
        '--connector',
        type=str,
        choices=['excel'],
        default=None,
        help='Forzar tipo de conector (ignora erp_type del tenant). Solo para testing.'
    )
    parser.add_argument(
        '--file',
        type=str,
        default=None,
        help='Ruta al archivo Excel (.xlsx). Requiere --connector excel.'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Forzar sync aunque ya haya habido uno exitoso hoy (bypass rate limit).'
    )

    args = parser.parse_args()

    # Validar que --file requiere --connector excel
    if args.file and not args.connector:
        print("ERROR: --file requiere --connector excel")
        sys.exit(1)
    if args.connector == 'excel' and not args.file:
        print("ERROR: --connector excel requiere --file <ruta.xlsx>")
        sys.exit(1)

    # Parsear --since como date
    since_date = None
    if args.since:
        try:
            since_date = date.fromisoformat(args.since)
        except ValueError:
            print(f"ERROR: Formato de fecha invalido: '{args.since}'. Usar YYYY-MM-DD")
            sys.exit(1)

    # Crear conector override si se pidio --connector
    connector_override = None
    source_override = None
    if args.connector == 'excel':
        from backend.engine.connectors.excel import ExcelConnector
        connector_override = ExcelConnector(args.file)
        source_override = 'excel'
        logger.info(f"Usando conector Excel override: {args.file}")

    # Ejecutar sync
    engine = SyncEngine()

    try:
        engine.run(
            tenant_slug=args.tenant_slug,
            since_date=since_date,
            limit=args.limit,
            test_only=args.test_only,
            connector_override=connector_override,
            source_override=source_override,
            force=args.force,
        )
    except Exception as e:
        logger.error(f"Sync fallido: {sanitize_text(str(e))}")
        sys.exit(1)


if __name__ == '__main__':
    main()
