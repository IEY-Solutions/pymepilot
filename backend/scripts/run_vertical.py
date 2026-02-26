#!/usr/bin/env python3
"""
Script CLI para ejecutar una vertical de prediccion de PymePilot.

QUE HACE ESTE SCRIPT:
Es el punto de entrada para generar predicciones. Ejecutas este comando
y PymePilot analiza los datos del ERP para decidir A QUIEN contactar,
CUANDO, y QUE ofrecer — generando mensajes personalizados con Claude.

CONCEPTO CLAVE - Entry Point:
Este script es como el "boton de arranque" del motor de prediccion.
Configura el entorno (variables, logging, conexion a DB) y delega
todo el trabajo a la vertical correspondiente.

CONCEPTO CLAVE - Dry Run:
Modo "simulacro". Ejecuta TODO el pipeline (candidatos, scores,
perfiles) pero SIN llamar a Claude. Sirve para verificar que todo
funciona sin gastar plata en tokens.

USO:
  python backend/scripts/run_vertical.py --tenant-slug iey                         # Ejecutar reposicion (default)
  python backend/scripts/run_vertical.py --tenant-slug iey --dry-run               # Simulacro (sin Claude)
  python backend/scripts/run_vertical.py --tenant-slug iey --limit 3               # Solo 3 candidatos
  python backend/scripts/run_vertical.py --tenant-slug iey --min-confidence 0.5    # Solo alta confianza
  python backend/scripts/run_vertical.py --tenant-slug iey --days-ahead 30         # Ventana mas amplia

ORDEN DE IMPORTS (obligatorio para entry points):
1. Imports de stdlib
2. load_dotenv() ANTES de imports del proyecto
3. os.umask(0o077) ANTES de crear archivos
4. Imports del proyecto
"""

import argparse
import os
import sys

# Agregar la raiz del proyecto al path de Python para que encuentre
# el paquete "backend". Sin esto, "from backend.config..." falla.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv

# load_dotenv ANTES de imports del proyecto (las API keys vienen de aca)
load_dotenv()

# umask ANTES de crear archivos (logs, etc.)
os.umask(0o077)

from backend.engine.core.logger import get_logger
from backend.engine.db.connection import close_pool
from backend.engine.verticales import VERTICAL_REGISTRY

logger = get_logger(__name__)


def _load_vertical_class(vertical_name: str):
    """Importa dinamicamente la clase de la vertical.

    CONCEPTO: Import dinamico. En vez de importar TODAS las verticales
    al inicio (lo cual cargaria codigo que tal vez no usamos), solo
    importamos la que necesitamos. Es como abrir solo el cajon que
    necesitas en vez de vaciar toda la cajonera.
    """
    if vertical_name not in VERTICAL_REGISTRY:
        available = ', '.join(sorted(VERTICAL_REGISTRY.keys()))
        raise ValueError(
            f"Vertical '{vertical_name}' no existe. "
            f"Disponibles: {available}"
        )

    module_path, class_name = VERTICAL_REGISTRY[vertical_name].rsplit('.', 1)

    import importlib
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Ejecutar vertical de prediccion de PymePilot',
    )
    parser.add_argument(
        '--tenant-slug',
        type=str,
        required=True,
        help='Slug del tenant (ej: iey)',
    )
    parser.add_argument(
        '--vertical',
        type=str,
        default='reposicion',
        choices=list(VERTICAL_REGISTRY.keys()),
        help='Vertical a ejecutar (default: reposicion)',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Ejecutar sin llamar a Claude (simula todo el pipeline)',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximo de candidatos a procesar (None = todos)',
    )
    parser.add_argument(
        '--min-confidence',
        type=float,
        default=0.0,
        help='Score minimo de confianza (0.0 a 1.0). Default: 0.0 (todos)',
    )
    parser.add_argument(
        '--days-ahead',
        type=int,
        default=None,
        help='(Reposicion) Dias hacia adelante para buscar candidatos',
    )
    parser.add_argument(
        '--days-overdue',
        type=int,
        default=None,
        help='(Reposicion) Dias de atraso para incluir como candidatos',
    )

    args = parser.parse_args()

    # Validar min-confidence
    if not 0.0 <= args.min_confidence <= 1.0:
        print("ERROR: --min-confidence debe estar entre 0.0 y 1.0")
        sys.exit(1)

    # Cargar la clase de la vertical
    try:
        vertical_class = _load_vertical_class(args.vertical)
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    # Instanciar la vertical
    vertical = vertical_class()

    # Aplicar configuracion especifica de reposicion si se paso
    if args.days_ahead is not None:
        if hasattr(vertical, 'days_ahead'):
            vertical.days_ahead = args.days_ahead
        else:
            logger.warning(
                f"--days-ahead no aplica a vertical '{args.vertical}'"
            )

    if args.days_overdue is not None:
        if hasattr(vertical, 'days_overdue'):
            vertical.days_overdue = args.days_overdue
        else:
            logger.warning(
                f"--days-overdue no aplica a vertical '{args.vertical}'"
            )

    # Ejecutar
    try:
        result = vertical.run(
            tenant_slug=args.tenant_slug,
            dry_run=args.dry_run,
            limit=args.limit,
            min_confidence=args.min_confidence,
        )
    except Exception as e:
        logger.error(f"Vertical fallida: {e}", exc_info=True)
        sys.exit(1)
    finally:
        close_pool()

    # Mostrar resumen en consola
    stats = result['stats']
    print()
    print("=" * 60)
    print(f"  RESULTADO: {args.vertical.upper()}")
    print(f"  Tenant: {args.tenant_slug}")
    print(f"  Modo: {'DRY-RUN (sin Claude)' if args.dry_run else 'PRODUCCION'}")
    print("=" * 60)
    print(f"  Procesados:        {stats['processed']}")
    print(f"  Baja confianza:    {stats['skipped_low_confidence']}")
    print(f"  Dedup (saltados):  {stats['skipped_dedup']}")
    print(f"  Fallidos:          {stats['failed']}")
    print(f"  Costo total:       ${stats['total_cost']:.6f} USD")

    if stats['stopped_by_limit']:
        print("  *** DETENIDO POR LIMITE DIARIO DE TOKENS ***")

    print("=" * 60)

    # Mostrar detalle de cada prediccion
    if result['results']:
        print()
        print("  DETALLE POR CANDIDATO:")
        print("  " + "-" * 56)
        for r in result['results']:
            print(
                f"  {r['customer_name']:<25} "
                f"conf={r['confidence']:.2f} "
                f"pri={r['priority']} "
                f"[{r['profile']}]"
            )
            print(f"    {r['message_preview']}")
            print()

    # Exit code basado en resultado
    if stats['failed'] > 0 and stats['processed'] == 0:
        sys.exit(1)  # Todo fallo


if __name__ == '__main__':
    main()
