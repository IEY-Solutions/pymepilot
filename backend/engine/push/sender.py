"""
Modulo de envio de Web Push Notifications.

QUE HACE:
Lee las suscripciones push de un tenant desde push_subscriptions,
y envia notificaciones via pywebpush. Si una suscripcion expiro
(HTTP 404 o 410), la elimina automaticamente.

POR QUE:
El vendedor necesita un empujon diario para entrar al dashboard.
Web Push API es gratuito y estandar (W3C).

CONCEPTO: VAPID (Voluntary Application Server Identification)
Es como una "firma digital" del servidor. El navegador verifica
que el push viene de nuestro servidor y no de un impostor.
Se genera un par de claves una sola vez y se guardan en .env.
"""

import json
import os

from backend.engine.core.logger import get_logger, sanitize_text
from backend.engine.db.connection import get_db_connection_no_tenant

logger = get_logger(__name__)


def send_push_to_tenant(
    tenant_id: str,
    title: str,
    body: str,
    url: str = "/contactar",
    tag: str = "pymepilot-daily",
) -> int:
    """Envia push notification a todas las suscripciones de un tenant.

    Args:
        tenant_id: UUID del tenant.
        title: Titulo de la notificacion.
        body: Cuerpo del mensaje.
        url: URL a abrir al hacer click.
        tag: Tag para agrupar/reemplazar notificaciones.

    Returns:
        Cantidad de notificaciones enviadas exitosamente.
    """
    # Importar pywebpush solo cuando se necesita (puede no estar instalado)
    try:
        from pywebpush import webpush, WebPushException  # type: ignore[import-untyped]
    except ImportError:
        logger.warning(
            "pywebpush no instalado. Push notifications deshabilitadas. "
            "Instalar con: pip install pywebpush"
        )
        return 0

    vapid_private_key_raw = os.environ.get("VAPID_PRIVATE_KEY")
    vapid_claims_email = os.environ.get("VAPID_CLAIMS_EMAIL")

    if not vapid_private_key_raw or not vapid_claims_email:
        logger.warning(
            "VAPID_PRIVATE_KEY o VAPID_CLAIMS_EMAIL no configuradas. "
            "Push notifications deshabilitadas."
        )
        return 0

    # Convertir clave raw base64url a objeto Vapid que pywebpush acepta
    try:
        from py_vapid import Vapid  # type: ignore[import-untyped]
        vapid = Vapid.from_raw(vapid_private_key_raw.encode())
    except Exception as e:
        logger.error(f"[push] Error cargando VAPID key: {sanitize_text(str(e))}")
        return 0

    # Leer suscripciones del tenant
    try:
        with get_db_connection_no_tenant() as conn:
            rows = conn.execute(
                "SELECT id, endpoint, p256dh, auth "
                "FROM public.push_subscriptions "
                "WHERE tenant_id = %s",
                (tenant_id,),
            ).fetchall()
    except Exception as e:
        logger.error(
            f"Error leyendo push_subscriptions: {sanitize_text(str(e))}"
        )
        return 0

    if not rows:
        logger.info(f"[push] Sin suscripciones para tenant {tenant_id[:8]}...")
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
    })

    sent = 0
    expired_ids: list[str] = []

    for row in rows:
        sub_id, endpoint, p256dh, auth = str(row[0]), row[1], row[2], row[3]

        subscription_info = {
            "endpoint": endpoint,
            "keys": {"p256dh": p256dh, "auth": auth},
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=vapid,
                vapid_claims={"sub": f"mailto:{vapid_claims_email}"},
            )
            sent += 1
        except WebPushException as e:
            status_code = getattr(e, "response", None)
            if status_code is not None:
                status_code = getattr(status_code, "status_code", None)

            if status_code in (404, 410):
                # Suscripcion expirada — marcar para eliminar
                expired_ids.append(sub_id)
                logger.info(
                    f"[push] Suscripcion expirada (HTTP {status_code}), "
                    f"eliminando {sub_id[:8]}..."
                )
            else:
                logger.warning(
                    f"[push] Error enviando push: {sanitize_text(str(e))}"
                )
        except Exception as e:
            logger.warning(
                f"[push] Error inesperado enviando push: "
                f"{sanitize_text(str(e))}"
            )

    # Limpiar suscripciones expiradas
    if expired_ids:
        try:
            with get_db_connection_no_tenant() as conn:
                conn.execute(
                    "DELETE FROM public.push_subscriptions "
                    "WHERE id = ANY(%s::uuid[])",
                    (expired_ids,),
                )
                conn.commit()
            logger.info(
                f"[push] Eliminadas {len(expired_ids)} suscripciones expiradas"
            )
        except Exception as e:
            logger.error(
                f"[push] Error eliminando suscripciones: "
                f"{sanitize_text(str(e))}"
            )

    logger.info(
        f"[push] Enviadas {sent}/{len(rows)} notificaciones "
        f"para tenant {tenant_id[:8]}..."
    )
    return sent
