#!/usr/bin/env python3
"""
Setup seguro de credenciales para PymePilot.

QUE HACE ESTE SCRIPT:
Dos funciones:
  --init           : Genera clave Fernet → la guarda en .env → chmod 600
  --tenant-slug iey: Pide credenciales por getpass() → las encripta → las guarda en DB

CONCEPTO CLAVE - getpass():
Es como escribir una contraseña en un formulario web: ves asteriscos
en vez del texto real. Nada queda en el historial de comandos.

SEGURIDAD:
- La clave Fernet NUNCA se muestra en pantalla ni queda en bash history
- Las credenciales del tenant se piden por getpass() (input oculto)
- .env obtiene permisos 600 (solo el owner puede leer/escribir)
- Se verifica que .env esta en .gitignore ANTES de hacer cualquier cosa

ORDEN DE IMPORTS (obligatorio para entry points):
1. Imports de stdlib
2. load_dotenv() ANTES de imports del proyecto
3. os.umask(0o077) ANTES de crear archivos
4. Imports del proyecto
"""

import argparse
import getpass
import os
import stat
import sys

from dotenv import load_dotenv

# load_dotenv ANTES de imports del proyecto
load_dotenv()

# umask ANTES de crear archivos (logs, etc.)
os.umask(0o077)

from backend.config.settings import ERP_ENCRYPTION_KEY
from backend.engine.connectors.crypto import (
    save_tenant_credentials,
    validate_fernet_key,
)
from backend.engine.core.logger import get_logger

logger = get_logger(__name__)

# Ruta al .env del proyecto
_PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_ENV_FILE = os.path.join(_PROJECT_DIR, '.env')
_GITIGNORE_FILE = os.path.join(_PROJECT_DIR, '.gitignore')


def _verify_gitignore() -> None:
    """Paso 0 — GUARD: Verifica que .env aparece en .gitignore.

    Dos modos de fallo, ambos ABORTAN con exit code 1:
    - Caso A: .gitignore no existe → ABORTA
    - Caso B: .gitignore existe pero no contiene .env → ABORTA
    """
    try:
        with open(_GITIGNORE_FILE, 'r') as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        # Caso A: .gitignore no existe
        print("PELIGRO: .gitignore no existe. Crealo con '.env' como primera linea antes de continuar.")
        sys.exit(1)

    # Caso B: .gitignore existe pero sin .env
    # Buscar '.env' como linea independiente (no .env.example, no comentario)
    env_protected = False
    for line in lines:
        stripped = line.strip()
        if stripped == '.env' or stripped == '.env*':
            env_protected = True
            break

    if not env_protected:
        print("PELIGRO: .env no esta en .gitignore. Agregalo antes de continuar.")
        sys.exit(1)


def cmd_init() -> None:
    """Genera clave Fernet → guarda en .env → chmod 600 → verifica permisos."""
    from cryptography.fernet import Fernet

    # Paso 0: verificar .gitignore
    _verify_gitignore()

    # Verificar si ya existe una clave
    if ERP_ENCRYPTION_KEY and validate_fernet_key(ERP_ENCRYPTION_KEY):
        print("ERP_ENCRYPTION_KEY ya existe y es valida. No se genera una nueva.")
        print("Si queres regenerarla, elimina la linea de .env primero.")
        return

    # Paso 1: Generar clave Fernet en memoria
    new_key = Fernet.generate_key().decode()

    # Paso 2: Escribir en .env (append o reemplazar)
    env_content = ''
    if os.path.exists(_ENV_FILE):
        with open(_ENV_FILE, 'r') as f:
            env_content = f.read()

    if 'ERP_ENCRYPTION_KEY=' in env_content:
        # Reemplazar linea existente
        lines = env_content.splitlines()
        new_lines = []
        for line in lines:
            if line.startswith('ERP_ENCRYPTION_KEY='):
                new_lines.append(f'ERP_ENCRYPTION_KEY={new_key}')
            else:
                new_lines.append(line)
        env_content = '\n'.join(new_lines) + '\n'
    else:
        # Append
        if env_content and not env_content.endswith('\n'):
            env_content += '\n'
        env_content += f'\n# --- Encriptacion ERP (generada por setup_credentials.py) ---\n'
        env_content += f'ERP_ENCRYPTION_KEY={new_key}\n'

    with open(_ENV_FILE, 'w') as f:
        f.write(env_content)

    # Paso 3: chmod 600
    os.chmod(_ENV_FILE, 0o600)

    # Paso 4: Verificar permisos
    file_mode = stat.S_IMODE(os.stat(_ENV_FILE).st_mode)
    if file_mode != 0o600:
        # Paso 5: Si falla, revertir
        print(f"ERROR: Permisos de .env son {oct(file_mode)}, esperaba 0o600")
        sys.exit(1)

    # Paso 6: Confirmar
    print("Clave Fernet generada, guardada en .env, permisos verificados (600)")
    print("La clave NUNCA se mostro en pantalla.")

    # Verificar/crear directorio de logs con permisos
    logs_dir = os.path.join(_PROJECT_DIR, 'backend', 'logs')
    os.makedirs(logs_dir, exist_ok=True)
    os.chmod(logs_dir, 0o700)
    print(f"Directorio de logs verificado: {logs_dir} (permisos 700)")


def cmd_tenant(tenant_slug: str) -> None:
    """Pide credenciales por getpass() → encripta → guarda en DB."""
    # Verificar que ERP_ENCRYPTION_KEY existe
    if not validate_fernet_key(ERP_ENCRYPTION_KEY):
        print(
            "ERP_ENCRYPTION_KEY no configurada o invalida. "
            "Ejecuta primero: python backend/scripts/setup_credentials.py --init"
        )
        sys.exit(1)

    print(f"\nConfigurando credenciales para tenant '{tenant_slug}'")
    print("Las credenciales se piden por input oculto (no se ven en pantalla).\n")

    client_id = input("Client ID (email de Contabilium): ").strip()
    if not client_id:
        print("ERROR: Client ID no puede estar vacio")
        sys.exit(1)

    client_secret = getpass.getpass("Client Secret (token API — NO se muestra): ")
    if not client_secret:
        print("ERROR: Client Secret no puede estar vacio")
        sys.exit(1)

    # Confirmar
    print(f"\nClient ID: {client_id}")
    print(f"Client Secret: {'*' * len(client_secret)} ({len(client_secret)} caracteres)")
    confirm = input("\nGuardar credenciales encriptadas? (si/no): ").strip().lower()

    if confirm != 'si':
        print("Cancelado.")
        return

    save_tenant_credentials(tenant_slug, client_id, client_secret, ERP_ENCRYPTION_KEY)
    print(f"\nCredenciales guardadas exitosamente para '{tenant_slug}' (encriptadas en DB)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Setup seguro de credenciales para PymePilot'
    )
    parser.add_argument(
        '--init',
        action='store_true',
        help='Genera clave Fernet → .env + chmod 600'
    )
    parser.add_argument(
        '--tenant-slug',
        type=str,
        help='Slug del tenant para configurar credenciales (ej: iey)'
    )

    args = parser.parse_args()

    if not args.init and not args.tenant_slug:
        parser.print_help()
        sys.exit(1)

    if args.init:
        cmd_init()

    if args.tenant_slug:
        cmd_tenant(args.tenant_slug)


if __name__ == '__main__':
    main()
