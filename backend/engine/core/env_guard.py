"""
Guard de variables de entorno criticas.

QUE HACE ESTE ARCHIVO:
Verifica que las variables de entorno necesarias existen y no estan vacias
ANTES de que el script intente usarlas. Si falta alguna, el script muere
inmediatamente con un mensaje claro en vez de fallar misteriosamente
despues (como paso el 7 de marzo con DATABASE_HOST).

CONCEPTO CLAVE - Fail-fast:
Es mejor que el programa explote al arrancar con un mensaje claro
("te falta DATABASE_HOST") que funcione 10 minutos y falle con un
error críptico ("connection refused to 127.0.0.1"). Fail-fast ahorra
tiempo de debugging.

POR QUE EXISTE:
El 7 de marzo, un .env espurio hizo que todos los scripts perdieran
DATABASE_HOST. Conectaban a localhost (default) en vez de 172.18.0.10.
22 horas de falla silenciosa. Con este guard, habrian muerto al segundo
1 con un mensaje explicito.

USO:
    from backend.engine.core.env_guard import validate_env

    validate_env(["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASSWORD"])
"""

import os
import sys

from backend.engine.core.logger import get_logger

logger = get_logger(__name__)

# Grupos predefinidos para no repetir listas en cada script
DB_VARS = ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASSWORD"]
SUPABASE_VARS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
ERP_VARS = ["ERP_ENCRYPTION_KEY"]
# L-06: Grupo para el motor de Claude (agregado en auditoria post-MVP)
CLAUDE_VARS = ["ANTHROPIC_API_KEY"]


def validate_env(required_vars: list[str]) -> None:
    """Verifica que las env vars criticas existen y no estan vacias.

    Si falta alguna, loguea CRITICAL y termina el proceso con exit code 1.
    Esto garantiza que ningun script corra con configuracion incompleta.

    Args:
        required_vars: Lista de nombres de variables que deben existir.
    """
    missing = []
    for var in required_vars:
        value = os.getenv(var)
        if not value or not value.strip():
            missing.append(var)

    if missing:
        msg = (
            f"Variables de entorno faltantes o vacias: {', '.join(missing)}. "
            f"Verificar que el archivo .env existe en la raiz del proyecto "
            f"y contiene estas variables."
        )
        logger.critical(msg)
        print(f"CRITICAL: {msg}", file=sys.stderr)
        sys.exit(1)
