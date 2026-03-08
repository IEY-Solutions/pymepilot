#!/usr/bin/env python3
"""
Wrapper para cron jobs con deteccion de fallas consecutivas y alertas push.

QUE HACE ESTE SCRIPT:
Envuelve cualquier cron job. Si el comando falla 3 veces seguidas,
envia una push notification a todos los tenants activos para que
Pato se entere en tiempo real.

CONCEPTO CLAVE - Wrapper pattern:
En vez de agregar logica de alertas a cada script individual (repetir
codigo en 5 lugares), envolvemos el script con este wrapper. Es como
poner un "sobre" alrededor de cada carta: el sobre tiene la direccion
de envio (la alerta), la carta adentro es el script original.

CONCEPTO CLAVE - Contador de fallas consecutivas:
Se guarda en /tmp/ (no en DB) porque:
1. Si la DB esta caida, no podemos escribir ahi (y esa es la falla)
2. /tmp/ se limpia al reiniciar el server (reset natural)
3. Operaciones read/write no son atomicas, pero el peor caso es
   perder 1 incremento — aceptable para un contador de alertas

POR QUE EXISTE:
El 7 de marzo, los crons fallaron 22 horas sin que nadie se enterara.
Con este wrapper, a las 3 fallas consecutivas Pato recibe un push.

USO en crontab:
    * * * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/cron_wrapper.py --name upload-worker -- backend/venv/bin/python backend/scripts/process_uploads.py >> /home/pato/logs/upload-worker.log 2>&1

USO manual:
    python backend/scripts/cron_wrapper.py --name test -- echo "hola"
    python backend/scripts/cron_wrapper.py --name test --threshold 5 -- ./mi_script.sh
"""

import argparse
import os
import re
import subprocess
import sys

# Entry point boilerplate
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, _project_root)

from dotenv import load_dotenv
load_dotenv(os.path.join(_project_root, ".env"))

os.umask(0o077)

from backend.engine.core.logger import get_logger, sanitize_text

logger = get_logger(__name__)

# Directorio para contadores de fallas (sobrevive entre ejecuciones)
_COUNTER_DIR = "/tmp/pymepilot-cron-failures"

# Umbral default: alertar despues de N fallas consecutivas
_DEFAULT_THRESHOLD = 3


_SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _get_counter_path(name: str) -> str:
    """Path al archivo contador de fallas para un cron job."""
    if not _SAFE_NAME_RE.match(name):
        raise ValueError(
            f"Nombre de cron invalido: '{name}'. "
            f"Solo se permiten letras, numeros, guion y guion bajo."
        )
    os.makedirs(_COUNTER_DIR, exist_ok=True)
    return os.path.join(_COUNTER_DIR, f"{name}.count")


def _read_counter(name: str) -> int:
    """Lee el contador de fallas consecutivas."""
    path = _get_counter_path(name)
    try:
        with open(path, "r") as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return 0


def _write_counter(name: str, count: int) -> None:
    """Escribe el contador de fallas consecutivas."""
    path = _get_counter_path(name)
    with open(path, "w") as f:
        f.write(str(count))


def _reset_counter(name: str) -> None:
    """Resetea el contador a 0 (el job tuvo exito)."""
    path = _get_counter_path(name)
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass


def _send_failure_alert(name: str, count: int, exit_code: int) -> None:
    """Envia push notification de falla a todos los tenants activos.

    Best-effort: si falla el push (DB caida, VAPID mal, etc.), solo loguea.
    No debe romper el cron wrapper por un error de push.
    """
    try:
        from backend.engine.db.connection import get_db_connection_no_tenant
        from backend.engine.push.sender import send_push_to_tenant

        # Obtener todos los tenant_id activos
        with get_db_connection_no_tenant() as conn:
            rows = conn.execute(
                "SELECT id FROM tenants WHERE active = true"
            ).fetchall()

        if not rows:
            return

        for row in rows:
            tenant_id = str(row[0])
            try:
                send_push_to_tenant(
                    tenant_id,
                    title=f"Alerta: cron '{name}' fallo {count}x",
                    body=(
                        f"El job '{name}' fallo {count} veces consecutivas "
                        f"(ultimo exit code: {exit_code}). Revisar logs."
                    ),
                    url="/datos",
                    tag=f"pymepilot-cron-{name}",
                )
            except Exception:
                pass  # Best-effort per tenant

        logger.warning(
            f"Push de alerta enviado: cron '{name}' fallo {count}x"
        )

    except Exception as e:
        logger.warning(
            f"No se pudo enviar alerta push para cron '{name}': "
            f"{sanitize_text(str(e))}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Wrapper para cron jobs con alertas de falla",
        # Permite pasar argumentos al comando hijo despues de '--'
        usage="%(prog)s --name NAME [--threshold N] -- COMMAND [ARGS...]",
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Nombre del cron job (para identificar en alertas y contadores)",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=_DEFAULT_THRESHOLD,
        help=f"Fallas consecutivas antes de alertar (default: {_DEFAULT_THRESHOLD})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Timeout en segundos para el comando hijo (default: 300)",
    )

    # Separar args del wrapper de los del comando hijo
    args, remaining = parser.parse_known_args()

    # Quitar el '--' separador si existe
    if remaining and remaining[0] == "--":
        remaining = remaining[1:]

    if not remaining:
        print("ERROR: debe especificar un comando despues de '--'")
        sys.exit(1)

    # Ejecutar el comando hijo
    try:
        result = subprocess.run(
            remaining,
            timeout=args.timeout,
        )
        exit_code = result.returncode
    except subprocess.TimeoutExpired:
        logger.error(f"Cron '{args.name}': timeout ({args.timeout}s)")
        exit_code = 124  # Convencion Unix para timeout
    except FileNotFoundError:
        logger.error(f"Cron '{args.name}': comando no encontrado: {remaining[0]}")
        exit_code = 127
    except Exception as e:
        logger.error(f"Cron '{args.name}': error ejecutando: {sanitize_text(str(e))}")
        exit_code = 1

    if exit_code == 0:
        # Exito: resetear contador
        prev = _read_counter(args.name)
        if prev > 0:
            logger.info(
                f"Cron '{args.name}': recuperado despues de {prev} falla(s)"
            )
        _reset_counter(args.name)
    else:
        # Falla: incrementar contador
        count = _read_counter(args.name) + 1
        _write_counter(args.name, count)

        logger.warning(
            f"Cron '{args.name}': falla #{count} (exit code {exit_code})"
        )

        # Alertar si alcanzo umbral (y en cada multiplo del umbral)
        if count >= args.threshold and count % args.threshold == 0:
            _send_failure_alert(args.name, count, exit_code)

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
