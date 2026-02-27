#!/usr/bin/env python3
"""
Orquestador diario de PymePilot (Fase 4).

QUE HACE ESTE SCRIPT:
Es el "capataz" del sistema. Cada dia a las 5 AM, ejecuta la pipeline
completa para cada tenant activo:
  1. Sync ERP → trae datos nuevos del sistema contable del cliente
  2. Atribucion → cruza predicciones anteriores con compras reales
  3. Verticales → genera predicciones del dia con Claude

Si un tenant falla, loguea el error y sigue con el siguiente.
Si el limite diario de tokens de Claude se alcanza, para las verticales
de TODOS los tenants pero completa los syncs y atribuciones pendientes.

CONCEPTO CLAVE - Orquestador:
Es como el director de una orquesta: no toca ningun instrumento,
pero coordina cuando entra cada uno. Cada "instrumento" (sync,
atribucion, vertical) ya sabe tocar su parte — el orquestador
solo dice "ahora vos" y registra si salio bien o mal.

CONCEPTO CLAVE - Pipeline:
Una secuencia de pasos donde cada uno depende del anterior.
No tiene sentido generar predicciones (paso 3) sin datos frescos
(paso 1), ni recomendar un producto que el cliente ya compro
(paso 2 detecta eso).

USO:
  python backend/main.py                       # Pipeline completa
  python backend/main.py --dry-run             # Sin llamadas a Claude
  python backend/main.py --tenant-slug iey     # Solo un tenant

ORDEN DE IMPORTS (obligatorio para entry points):
1. Imports de stdlib
2. load_dotenv() ANTES de imports del proyecto
3. os.umask(0o077) ANTES de crear archivos
4. Imports del proyecto
"""

import argparse
import importlib
import json
import os
import sys
from datetime import date
from decimal import Decimal

# Agregar la raiz del proyecto al path de Python.
# main.py esta en backend/, asi que subimos 1 nivel para llegar a pymepilot/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

# load_dotenv ANTES de imports del proyecto
load_dotenv()

# umask ANTES de crear archivos (logs, etc.)
os.umask(0o077)

from backend.engine.claude.client import DailyLimitExceeded
from backend.engine.connectors.sync import SyncEngine
from backend.engine.core.logger import get_logger, sanitize_text
from backend.engine.db.connection import (
    close_pool,
    get_db_connection,
    get_db_connection_no_tenant,
)
from backend.engine.db.queries import (
    get_predictions_for_attribution,
    refresh_materialized_views,
    update_prediction_attribution,
)
from backend.engine.verticales import VERTICAL_REGISTRY

logger = get_logger(__name__)


# ================================================================
# FUNCIONES AUXILIARES
# ================================================================

def _load_vertical_class(vertical_name: str):
    """Importa dinamicamente la clase de una vertical.

    CONCEPTO: Import dinamico. Solo cargamos el codigo de la vertical
    que necesitamos, no todas. Es mas eficiente y evita errores si
    una vertical tiene dependencias que no estan instaladas.

    Raises:
        ValueError: Si la vertical no esta en el registry.
    """
    if vertical_name not in VERTICAL_REGISTRY:
        available = ', '.join(sorted(VERTICAL_REGISTRY.keys()))
        raise ValueError(
            f"Vertical '{vertical_name}' no registrada. "
            f"Disponibles: {available}"
        )

    module_path, class_name = VERTICAL_REGISTRY[vertical_name].rsplit('.', 1)
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


def _get_active_tenants(conn, tenant_slug: str | None = None) -> list[dict]:
    """Lee tenants activos de la DB.

    Si se pasa tenant_slug, filtra por ese tenant especifico.
    Retorna lista de dicts con id, slug, name, erp_type, active_verticals.
    """
    if tenant_slug:
        rows = conn.execute(
            "SELECT id, slug, name, erp_type, active_verticals "
            "FROM public.tenants WHERE slug = %s AND active = true",
            (tenant_slug,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, slug, name, erp_type, active_verticals "
            "FROM public.tenants WHERE active = true"
        ).fetchall()

    tenants = []
    for row in rows:
        # psycopg3 parsea JSONB automaticamente a Python list/dict.
        # El isinstance es un guard defensivo por si viene como string.
        verticals = row[4]
        if isinstance(verticals, str):
            verticals = json.loads(verticals)
        if verticals is None:
            verticals = []

        tenants.append({
            'id': str(row[0]),
            'slug': row[1],
            'name': row[2],
            'erp_type': row[3],
            'active_verticals': verticals,
        })

    return tenants


def _create_run(conn) -> str:
    """Crea registro en orchestrator_runs con status='running'.

    Se crea al INICIO de la corrida. Si el orquestador se cuelga,
    la fila queda en 'running' — eso es informacion valiosa para
    diagnosticar que paso.

    Returns:
        UUID del registro creado (como string).
    """
    row = conn.execute(
        "INSERT INTO public.orchestrator_runs (status) "
        "VALUES ('running') RETURNING id"
    ).fetchone()
    conn.commit()
    return str(row[0])


def _update_run(
    conn,
    run_id: str,
    status: str,
    tenants_processed: int,
    predictions_generated: int,
    errors: list,
) -> None:
    """Actualiza el registro de orchestrator_runs al finalizar.

    Se llama al final (exito o error) para registrar el resultado.
    Los errores se sanitizan antes de guardar para no filtrar info interna.
    """
    conn.execute(
        "UPDATE public.orchestrator_runs "
        "SET completed_at = now(), status = %s, tenants_processed = %s, "
        "    predictions_generated = %s, errors = %s::jsonb "
        "WHERE id = %s::uuid",
        (status, tenants_processed, predictions_generated,
         json.dumps(errors), run_id)
    )
    conn.commit()


# ================================================================
# PASOS DE LA PIPELINE
# ================================================================

def _run_sync(tenant: dict) -> bool:
    """Ejecuta sync ERP para un tenant.

    Solo aplica a tenants con canal API (contabilium, xubio, etc.).
    Tenants con erp_type='excel' se sincronizan via Drive o Upload,
    que tienen su propia automatizacion (cron independiente).

    Returns:
        True si el sync fue exitoso (o no aplica). False si fallo.
    """
    # Canales que se sincronizan por otra via (no API directa)
    non_api_channels = ('excel',)

    if tenant['erp_type'] in non_api_channels:
        logger.info(
            f"[{tenant['slug']}] Sync skip: canal '{tenant['erp_type']}' "
            f"(sincronizado por Drive/Upload)"
        )
        return True  # No es error, simplemente no aplica

    logger.info(f"[{tenant['slug']}] Sync ERP iniciando...")

    engine = SyncEngine()
    try:
        engine.run(tenant_slug=tenant['slug'])
        logger.info(f"[{tenant['slug']}] Sync ERP completado")
        return True
    except Exception as e:
        logger.error(
            f"[{tenant['slug']}] Sync ERP fallido: {sanitize_text(str(e))}",
            exc_info=True,
        )
        return False


def _run_attribution(tenant_id: str, tenant_slug: str) -> int:
    """Ejecuta atribucion para un tenant.

    Cruza predicciones pendientes/contactadas contra compras reales.
    Si un cliente compro lo que le recomendamos, la prediccion se
    marca como 'completed'.

    SIEMPRE corre real (no dry-run): no usa Claude, no cuesta plata,
    y es necesaria antes de verticales para no recomendar lo ya comprado.

    Returns:
        Cantidad de predicciones atribuidas (0 si no hay matches).
    """
    logger.info(f"[{tenant_slug}] Atribucion iniciando...")

    try:
        with get_db_connection(tenant_id) as conn:
            matches_raw = get_predictions_for_attribution(
                conn, tenant_id, attribution_window_days=14
            )

            if not matches_raw:
                logger.info(f"[{tenant_slug}] Atribucion: 0 matches")
                return 0

            # Deduplicar: una prediccion → una orden (la mas cercana)
            best: dict[str, dict] = {}
            for match in matches_raw:
                pred_id = str(match['prediction_id'])
                days = match['days_to_purchase']
                if pred_id not in best or days < best[pred_id]['days_to_purchase']:
                    best[pred_id] = match

            # Aplicar atribuciones
            for pred_id, match in best.items():
                order_amount = Decimal(str(match['order_amount']))
                update_prediction_attribution(
                    conn,
                    tenant_id=tenant_id,
                    prediction_id=pred_id,
                    order_id=str(match['order_id']),
                    order_amount=order_amount,
                )
            conn.commit()

            logger.info(
                f"[{tenant_slug}] Atribucion completada: "
                f"{len(best)} predicciones atribuidas"
            )
            return len(best)

    except Exception as e:
        logger.error(
            f"[{tenant_slug}] Atribucion fallida: {sanitize_text(str(e))}",
            exc_info=True,
        )
        return 0


def _refresh_views() -> bool:
    """Refresca las vistas materializadas co_purchases y client_rankings.

    CONCEPTO: Las vistas materializadas son como "reportes pre-calculados"
    que se guardan en disco. Se refrescan una vez al dia con datos nuevos
    para que las queries del motor (V3 Cross-Sell) y del dashboard
    (Ranking Clientes) sean instantaneas.

    Se ejecuta UNA vez al inicio del pipeline (no por tenant) porque
    las MVs ya contienen datos de TODOS los tenants.

    La funcion SQL refresh_materialized_views() usa SECURITY DEFINER
    para correr como superuser y bypasear RLS al leer datos de todos
    los tenants.

    Returns:
        True si el refresh fue exitoso, False si fallo.
    """
    logger.info("Refrescando vistas materializadas...")

    try:
        with get_db_connection_no_tenant() as conn:
            refresh_materialized_views(conn)
        logger.info("Vistas materializadas refrescadas OK")
        return True
    except Exception as e:
        logger.error(
            f"Refresh de vistas materializadas fallido: "
            f"{sanitize_text(str(e))}",
            exc_info=True,
        )
        return False


# Verticales que solo se ejecutan ciertos dias de la semana.
# V3 Cross-Sell: solo lunes (weekday() == 0) — no tiene sentido
# sugerir productos nuevos todos los dias, una vez por semana basta.
_WEEKLY_VERTICALS: dict[str, int] = {
    'cross_sell': 0,  # 0 = Monday
}


def _run_verticals(tenant: dict, dry_run: bool) -> dict:
    """Ejecuta las verticales activas para un tenant.

    Lee active_verticals del tenant y ejecuta cada una en orden.
    Si DailyLimitExceeded salta, para inmediatamente.

    Verticales semanales (cross_sell) se saltean si no es el dia
    configurado, a menos que estemos en dry-run o el tenant se paso
    explicitamente (para testing).

    Args:
        tenant: Dict con datos del tenant (incluye active_verticals).
        dry_run: Si True, las verticales no llaman a Claude.

    Returns:
        dict con 'predictions' (int) y 'limit_exceeded' (bool).
    """
    result = {'predictions': 0, 'limit_exceeded': False}
    verticals = tenant.get('active_verticals', [])
    today_weekday = date.today().weekday()

    if not verticals:
        logger.info(f"[{tenant['slug']}] Sin verticales activas configuradas")
        return result

    for vertical_name in verticals:
        # --- Check: verticales semanales ---
        if vertical_name in _WEEKLY_VERTICALS:
            expected_day = _WEEKLY_VERTICALS[vertical_name]
            if today_weekday != expected_day:
                day_names = ['lunes', 'martes', 'miercoles', 'jueves',
                             'viernes', 'sabado', 'domingo']
                logger.info(
                    f"[{tenant['slug']}] Vertical '{vertical_name}' skip: "
                    f"solo corre los {day_names[expected_day]} "
                    f"(hoy es {day_names[today_weekday]})"
                )
                continue

        logger.info(f"[{tenant['slug']}] Vertical '{vertical_name}' iniciando...")

        try:
            vertical_class = _load_vertical_class(vertical_name)
            vertical = vertical_class()
            vresult = vertical.run(
                tenant_slug=tenant['slug'],
                dry_run=dry_run,
            )

            stats = vresult['stats']
            result['predictions'] += stats['processed']

            if stats['stopped_by_limit']:
                result['limit_exceeded'] = True
                logger.warning(
                    f"[{tenant['slug']}] Limite diario alcanzado en "
                    f"vertical '{vertical_name}'"
                )
                return result

            logger.info(
                f"[{tenant['slug']}] Vertical '{vertical_name}' completada: "
                f"{stats['processed']} predicciones, "
                f"${stats['total_cost']:.6f} USD"
            )

        except DailyLimitExceeded:
            result['limit_exceeded'] = True
            logger.warning(
                f"[{tenant['slug']}] DailyLimitExceeded en '{vertical_name}'"
            )
            return result

        except ValueError as e:
            # Vertical no registrada en VERTICAL_REGISTRY
            logger.error(f"[{tenant['slug']}] {e}")

        except Exception as e:
            logger.error(
                f"[{tenant['slug']}] Vertical '{vertical_name}' fallida: "
                f"{sanitize_text(str(e))}",
                exc_info=True,
            )

    return result


# ================================================================
# FUNCION PRINCIPAL
# ================================================================

def main() -> None:
    parser = argparse.ArgumentParser(
        description='Orquestador diario de PymePilot',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Ejecutar sin llamadas a Claude (sync y atribucion corren normal)',
    )
    parser.add_argument(
        '--tenant-slug',
        type=str,
        default=None,
        help='Ejecutar solo para un tenant especifico (default: todos los activos)',
    )

    args = parser.parse_args()

    mode = "DRY-RUN" if args.dry_run else "PRODUCCION"
    logger.info(f"{'=' * 60}")
    logger.info(f"ORQUESTADOR INICIADO | modo={mode}")
    logger.info(f"{'=' * 60}")

    run_id = None
    errors: list[dict] = []
    tenants_ok = 0
    total_predictions = 0
    daily_limit_hit = False
    tenants: list[dict] = []
    status = 'failed'  # Default pesimista, se actualiza si todo sale bien

    try:
        # --- Paso 1: Crear registro de corrida ---
        with get_db_connection_no_tenant() as conn:
            run_id = _create_run(conn)

        logger.info(f"Run ID: {run_id}")

        # --- Paso 2: Leer tenants activos ---
        with get_db_connection_no_tenant() as conn:
            tenants = _get_active_tenants(conn, args.tenant_slug)

        if not tenants:
            msg = (
                f"Tenant '{args.tenant_slug}' no encontrado o inactivo"
                if args.tenant_slug
                else "No hay tenants activos"
            )
            logger.warning(msg)
            with get_db_connection_no_tenant() as conn:
                _update_run(conn, run_id, 'completed', 0, 0, [])
            return

        logger.info(
            f"Tenants a procesar: {len(tenants)} "
            f"— {[t['slug'] for t in tenants]}"
        )

        # --- Paso 2b: Refrescar vistas materializadas ---
        # Se ejecuta UNA vez (no por tenant) porque las MVs contienen
        # datos de todos los tenants. Necesario ANTES de verticales
        # para que V3 Cross-Sell vea datos frescos en co_purchases.
        if not _refresh_views():
            errors.append({
                'step': 'refresh_views',
                'error': 'Refresh de vistas materializadas fallido',
            })
            # No es fatal: las MVs tienen datos del dia anterior

        # --- Paso 3: Procesar cada tenant ---
        for tenant in tenants:
            tenant_slug = tenant['slug']
            tenant_id = tenant['id']

            logger.info(f"{'─' * 40}")
            logger.info(
                f"Procesando: {tenant['name']} ({tenant_slug}) | "
                f"ERP: {tenant['erp_type']} | "
                f"Verticales: {tenant['active_verticals']}"
            )

            # 3a. Sync ERP
            sync_ok = _run_sync(tenant)

            if not sync_ok:
                errors.append({
                    'tenant': tenant_slug,
                    'step': 'sync',
                    'error': 'Sync ERP fallido (ver logs para detalle)',
                })
                logger.warning(
                    f"[{tenant_slug}] Sync fallo → skip atribucion y verticales"
                )
                continue  # Siguiente tenant

            # 3b. Atribucion (siempre real, no usa Claude)
            _run_attribution(tenant_id, tenant_slug)

            # 3c. Verticales
            if not daily_limit_hit:
                vresult = _run_verticals(tenant, dry_run=args.dry_run)
                total_predictions += vresult['predictions']

                if vresult['limit_exceeded']:
                    daily_limit_hit = True
                    errors.append({
                        'tenant': tenant_slug,
                        'step': 'verticals',
                        'error': 'Limite diario de tokens alcanzado',
                    })
                    logger.warning(
                        "Limite diario alcanzado — verticales deshabilitadas "
                        "para tenants restantes"
                    )
            else:
                logger.info(
                    f"[{tenant_slug}] Verticales skip: "
                    f"limite diario ya alcanzado"
                )

            tenants_ok += 1

        # --- Paso 4: Determinar status final ---
        if daily_limit_hit:
            status = 'limit_exceeded'
        elif errors:
            status = 'partial' if tenants_ok > 0 else 'failed'
        else:
            status = 'completed'

        # --- Paso 5: Actualizar registro ---
        with get_db_connection_no_tenant() as conn:
            _update_run(
                conn, run_id, status,
                tenants_ok, total_predictions, errors,
            )

    except Exception as e:
        # Error catastrofico (DB caida, pool roto, etc.)
        logger.error(
            f"Error catastrofico en orquestador: {sanitize_text(str(e))}",
            exc_info=True,
        )

        if run_id:
            try:
                with get_db_connection_no_tenant() as conn:
                    _update_run(
                        conn, run_id, 'failed',
                        tenants_ok, total_predictions,
                        errors + [{
                            'step': 'orchestrator',
                            'error': sanitize_text(str(e)),
                        }],
                    )
            except Exception:
                logger.error(
                    "No se pudo actualizar orchestrator_runs "
                    "despues del error catastrofico"
                )

    finally:
        close_pool()

    # --- Resumen en consola ---
    print()
    print("=" * 60)
    print(f"  ORQUESTADOR {'DRY-RUN' if args.dry_run else 'COMPLETADO'}")
    print(f"  Status: {status}")
    print(f"  Tenants procesados: {tenants_ok}/{len(tenants)}")
    print(f"  Predicciones generadas: {total_predictions}")
    if errors:
        print(f"  Errores: {len(errors)}")
        for err in errors:
            print(f"    - [{err.get('tenant', '?')}] {err.get('step', '?')}: {err.get('error', '?')}")
    if daily_limit_hit:
        print("  *** LIMITE DIARIO DE TOKENS ALCANZADO ***")
    print("=" * 60)


if __name__ == '__main__':
    main()
