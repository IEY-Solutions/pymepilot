#!/usr/bin/env python3
"""
Script CLI para atribucion automatica de predicciones.

QUE HACE ESTE SCRIPT:
Despues de cada sync del ERP (que trae compras nuevas), este script cruza
las predicciones pendientes con las compras reales. Si PymePilot predijo
que Juan iba a comprar, y Juan compro dentro de los 14 dias siguientes,
la prediccion se marca como "completed" automaticamente.

CONCEPTO CLAVE - Atribucion:
Es como un sistema de goles en un partido. Si la pelota entro al arco
(el cliente compro), el gol se cuenta solo — no necesitas que el arbitro
(el vendedor) lo confirme manualmente. El dato esta en el ERP.

CONCEPTO CLAVE - Deduplicacion:
Si un cliente compro 2 veces en la ventana de atribucion, solo se cuenta
la primera compra (la mas cercana a la prediccion). Asi evitamos inflar
las metricas contando una prediccion como 2 conversiones.

USO:
  python backend/scripts/run_attribution.py --tenant-slug iey                 # Atribucion con ventana default (14 dias)
  python backend/scripts/run_attribution.py --tenant-slug iey --dry-run       # Mostrar matches sin modificar DB
  python backend/scripts/run_attribution.py --tenant-slug iey --window-days 7 # Ventana mas corta

ORDEN DE IMPORTS (obligatorio para entry points):
1. Imports de stdlib
2. load_dotenv() ANTES de imports del proyecto
3. os.umask(0o077) ANTES de crear archivos
4. Imports del proyecto
"""

import argparse
import os
import sys
from decimal import Decimal

# Agregar la raiz del proyecto al path de Python para que encuentre
# el paquete "backend". Sin esto, "from backend.config..." falla.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv

# load_dotenv ANTES de imports del proyecto (las variables de entorno vienen de aca)
load_dotenv()

# umask ANTES de crear archivos (logs, etc.)
os.umask(0o077)

from backend.engine.core.logger import get_logger
from backend.engine.db.connection import (
    close_pool,
    get_db_connection,
    get_tenant_id_by_slug,
)
from backend.engine.db.queries import (
    get_predictions_for_attribution,
    update_prediction_attribution,
)

logger = get_logger(__name__)


def _deduplicate_matches(matches: list[dict]) -> dict[str, dict]:
    """Deduplica matches: una prediccion solo se atribuye a una orden.

    QUE HACE: Si un cliente compro 2 veces dentro de la ventana de
    atribucion, hay 2 filas para la misma prediccion. Nos quedamos
    con la compra mas cercana a la prediccion (menor days_to_purchase).

    POR QUE: Contar una prediccion como 2 conversiones inflaria las
    metricas. Es como contar un gol dos veces porque la pelota reboto.

    CONCEPTO CLAVE - Dict como deduplicador:
    Usamos un dict con prediction_id como key. Si aparece dos veces,
    solo guardamos la que tiene days_to_purchase mas chico.

    Args:
        matches: Lista de dicts de get_predictions_for_attribution.

    Returns:
        Dict {prediction_id: match_dict} con el mejor match por prediccion.
    """
    best: dict[str, dict] = {}

    for match in matches:
        pred_id = str(match['prediction_id'])
        days = match['days_to_purchase']

        if pred_id not in best or days < best[pred_id]['days_to_purchase']:
            best[pred_id] = match

    if len(best) < len(matches):
        logger.info(
            f"Deduplicacion: {len(matches)} matches raw → "
            f"{len(best)} predicciones unicas"
        )

    return best


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Atribucion automatica de predicciones de PymePilot',
    )
    parser.add_argument(
        '--tenant-slug',
        type=str,
        required=True,
        help='Slug del tenant (ej: iey)',
    )
    parser.add_argument(
        '--window-days',
        type=int,
        default=14,
        help='Ventana de atribucion en dias (default: 14)',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Mostrar matches sin modificar la base de datos',
    )

    args = parser.parse_args()

    # Validar window-days
    if args.window_days < 1 or args.window_days > 90:
        print("ERROR: --window-days debe estar entre 1 y 90")
        sys.exit(1)

    mode_label = "DRY-RUN" if args.dry_run else "PRODUCCION"
    logger.info(
        f"Atribucion iniciada: tenant={args.tenant_slug}, "
        f"ventana={args.window_days} dias, modo={mode_label}"
    )

    # 1. Resolver tenant_id desde slug
    try:
        tenant_id = get_tenant_id_by_slug(args.tenant_slug)
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    logger.info(f"Tenant resuelto: {args.tenant_slug} → {tenant_id}")

    try:
        # 2. Abrir conexion con tenant context y buscar matches
        with get_db_connection(tenant_id) as conn:
            matches_raw = get_predictions_for_attribution(
                conn, tenant_id, args.window_days
            )

            # 3. Sin matches → salir OK
            if not matches_raw:
                print()
                print("Sin predicciones para atribuir. Todo al dia.")
                logger.info("Atribucion completada: 0 matches encontrados")
                return

            # 4. Deduplicar (una prediccion → una orden)
            matches = _deduplicate_matches(matches_raw)

            # 5. Procesar matches
            attributed_count = 0
            total_amount = Decimal('0')

            for pred_id, match in matches.items():
                order_amount = Decimal(str(match['order_amount']))

                if args.dry_run:
                    print(
                        f"  [DRY-RUN] Prediccion {pred_id[:8]}... → "
                        f"Orden {str(match['order_id'])[:8]}... "
                        f"${order_amount:,.2f} "
                        f"({match['days_to_purchase']}d despues)"
                    )
                else:
                    update_prediction_attribution(
                        conn,
                        tenant_id=tenant_id,
                        prediction_id=pred_id,
                        order_id=str(match['order_id']),
                        order_amount=order_amount,
                    )

                attributed_count += 1
                total_amount += order_amount

            # 6. Commit (todas las atribuciones en una transaccion)
            if not args.dry_run:
                conn.commit()
                logger.info(
                    f"Commit exitoso: {attributed_count} atribuciones"
                )

    except Exception as e:
        logger.error(f"Atribucion fallida: {e}", exc_info=True)
        sys.exit(1)
    finally:
        close_pool()

    # 7. Resumen
    print()
    print("=" * 60)
    print(f"  ATRIBUCION: {'DRY-RUN' if args.dry_run else 'COMPLETADA'}")
    print(f"  Tenant: {args.tenant_slug}")
    print(f"  Ventana: {args.window_days} dias")
    print("=" * 60)
    print(f"  Predicciones atribuidas:  {attributed_count}")
    print(f"  Monto total atribuido:    ${total_amount:,.2f}")
    print("=" * 60)

    if args.dry_run:
        print()
        print("  Modo DRY-RUN: no se modifico la base de datos.")
        print("  Ejecutar sin --dry-run para aplicar los cambios.")

    logger.info(
        f"Atribucion finalizada: {attributed_count} predicciones, "
        f"monto total ${total_amount:,.2f}"
    )


if __name__ == '__main__':
    main()
