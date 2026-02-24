#!/usr/bin/env python3
"""
Script de verificacion de frescura de datos por tenant.

QUE HACE ESTE SCRIPT:
Se ejecuta diariamente a las 5:30 AM (despues del sync ERP a las 5:00 AM).
Para cada tenant activo, verifica cuantas horas pasaron desde la ultima
sincronizacion. Si supero el umbral configurado (default 72h), crea una
notificacion en el dashboard.

CONCEPTO CLAVE - Polling vs Push:
En vez de que el dashboard revise constantemente si los datos estan viejos,
este script lo hace una vez al dia y deja una "nota" (notificacion) en la
base de datos. El dashboard solo lee las notas. Es como un cartero que
pasa una vez al dia y deja cartas, en vez de tener a alguien mirando
el buzon cada 5 minutos.

CONCEPTO CLAVE - Cross-tenant:
Este script necesita ver TODOS los tenants para verificar cada uno.
Por eso usa get_db_connection_no_tenant() (sin contexto de tenant).
Las policies RLS de pymepilot_app permiten acceso cross-tenant.

CRON:
    30 5 * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/check_data_freshness.py >> /home/pato/logs/freshness-check.log 2>&1
"""

import json
import os
import sys
from datetime import datetime, timezone

# Entry point boilerplate (mismo patron que process_uploads.py)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

os.umask(0o077)

from backend.engine.core.logger import get_logger
from backend.engine.db.connection import get_db_connection_no_tenant, close_pool

logger = get_logger(__name__)

# Umbral por defecto si el tenant no tiene configuracion propia
DEFAULT_STALE_THRESHOLD_HOURS = 72


def check_all_tenants() -> None:
    """Verifica frescura de datos para todos los tenants activos.

    QUE HACE: Recorre cada tenant y verifica si sus datos estan
    desactualizados. Si lo estan, crea una notificacion en el dashboard.

    POR QUE: El distribuidor necesita saber que sus predicciones
    pueden ser imprecisas si los datos estan viejos. Una notificacion
    proactiva lo guia a actualizar.

    Flujo por tenant:
    1. Obtener ultima sync de sync_log
    2. Calcular horas de antiguedad
    3. Obtener umbral de tenant_notification_config (o default 72h)
    4. Si supera umbral: verificar si ya notifico hoy
    5. Si no notifico: insertar notificacion
    """
    with get_db_connection_no_tenant() as conn:
        # Obtener todos los tenants activos
        tenants = conn.execute(
            "SELECT id, name FROM tenants WHERE active = true"
        ).fetchall()

        if not tenants:
            logger.info("No hay tenants activos")
            return

        logger.info(f"Verificando frescura para {len(tenants)} tenants")

        for tenant_id, tenant_name in tenants:
            try:
                _check_tenant(conn, tenant_id, tenant_name)
            except Exception as exc:
                # Un tenant falla → no para los demas (aislamiento)
                logger.error(
                    f"Error verificando tenant {tenant_name} ({tenant_id}): {exc}"
                )

        conn.commit()


def _check_tenant(conn, tenant_id, tenant_name: str) -> None:
    """Verifica frescura para un tenant especifico.

    Args:
        conn: Conexion a DB (sin tenant context)
        tenant_id: UUID del tenant
        tenant_name: Nombre para logging
    """
    # 1. Ultima sync exitosa
    last_sync = conn.execute(
        """
        SELECT started_at FROM sync_log
        WHERE tenant_id = %s AND status = 'completed'
        ORDER BY started_at DESC LIMIT 1
        """,
        (tenant_id,),
    ).fetchone()

    now = datetime.now(timezone.utc)

    if last_sync is None:
        # Nunca hizo sync → notificar con mensaje especial
        age_hours = None
        age_label = "nunca sincronizados"
    else:
        started_at = last_sync[0]
        # Asegurar timezone-aware para restar correctamente
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        age_hours = (now - started_at).total_seconds() / 3600
        days = int(age_hours // 24)
        if days > 0:
            age_label = f"de hace {days} dia{'s' if days != 1 else ''}"
        else:
            age_label = f"de hace {int(age_hours)} horas"

    # 2. Obtener umbral configurado (o default)
    config = conn.execute(
        """
        SELECT stale_data_threshold_hours FROM tenant_notification_config
        WHERE tenant_id = %s
        """,
        (tenant_id,),
    ).fetchone()

    threshold = config[0] if config else DEFAULT_STALE_THRESHOLD_HOURS

    # 3. Supero umbral?
    # age_hours=None significa "nunca sincronizo" → siempre supera
    if age_hours is not None and age_hours < threshold:
        logger.debug(
            f"Tenant {tenant_name}: datos OK "
            f"({age_hours:.1f}h < {threshold}h umbral)"
        )
        return

    # 4. Ya notifico hoy? (evitar spam de notificaciones)
    already_notified = conn.execute(
        """
        SELECT 1 FROM notifications
        WHERE tenant_id = %s
          AND type = 'stale_data'
          AND created_at::date = CURRENT_DATE
        LIMIT 1
        """,
        (tenant_id,),
    ).fetchone()

    if already_notified:
        logger.debug(f"Tenant {tenant_name}: ya notificado hoy, saltando")
        return

    # 5. Crear notificacion en el dashboard
    metadata = json.dumps({
        "age_hours": round(age_hours, 1) if age_hours is not None else None,
        "threshold_hours": threshold,
    })

    conn.execute(
        """
        INSERT INTO notifications (tenant_id, channel, type, title, message, metadata)
        VALUES (%s, 'dashboard', 'stale_data', %s, %s, %s::jsonb)
        """,
        (
            tenant_id,
            "Datos desactualizados",
            f"Tus datos estan {age_label}. "
            "Subi un archivo actualizado para mejorar las predicciones.",
            metadata,
        ),
    )

    logger.info(
        f"Tenant {tenant_name}: notificacion creada "
        f"(datos {age_label}, umbral {threshold}h)"
    )


def main() -> None:
    try:
        check_all_tenants()
    finally:
        close_pool()


if __name__ == "__main__":
    main()
