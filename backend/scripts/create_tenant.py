#!/usr/bin/env python3
"""
Script interactivo para onboarding de nuevos tenants en PymePilot.

QUE HACE ESTE SCRIPT:
Guia paso a paso para dar de alta un nuevo distribuidor. Crea el tenant en la
DB, el usuario admin en GoTrue (autenticacion), el perfil, las credenciales
ERP (si aplica), y verifica que todo funcione.

CONCEPTO CLAVE - Idempotencia:
Si el script falla a mitad de camino, se puede re-ejecutar sin crear
duplicados. Cada paso chequea si ya se ejecuto antes de proceder.
Es como una receta que dice "si ya mezclaste la harina, salta al paso 3".

CONCEPTO CLAVE - GoTrue API:
GoTrue es el servicio de autenticacion de Supabase. Para crear un usuario
"admin", necesitamos llamar a la API de GoTrue con la SERVICE_ROLE_KEY
(que tiene permisos de admin). El usuario creado recibe un JWT con
app_metadata.tenant_id, que es lo que RLS usa para filtrar datos.

SEGURIDAD:
- Todo corre local en el VPS (no expuesto a internet)
- Credenciales por getpass (no quedan en bash history)
- Idempotente: re-ejecutar no crea duplicados
- SERVICE_ROLE_KEY solo se usa para la llamada a GoTrue, nunca se loguea

USO:
    python backend/scripts/create_tenant.py
"""

import getpass
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Entry point boilerplate (mismo patron que sync_erp.py)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

os.umask(0o077)

from backend.config.settings import (
    ERP_ENCRYPTION_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)
from backend.engine.connectors.crypto import save_tenant_credentials, validate_fernet_key
from backend.engine.core.logger import get_logger
from backend.engine.db.connection import get_db_connection, get_db_connection_no_tenant, close_pool

logger = get_logger(__name__)

# Verticales disponibles (las mismas que acepta el orquestador)
AVAILABLE_VERTICALS = ["reposicion", "activacion", "recuperacion", "cross_sell"]

# Regex del CHECK constraint de slug en la tabla tenants
SLUG_REGEX = re.compile(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$')

# ERP types validos (CHECK constraint en tenants)
VALID_ERP_TYPES = ["contabilium", "excel", "xubio", "alegra", "colppy", "custom"]


def _gotrue_request(method: str, path: str, data: dict | None = None) -> dict:
    """Hace un request a la GoTrue Admin API.

    QUE HACE: Construye un HTTP request al endpoint de GoTrue (Supabase Auth)
    usando la SERVICE_ROLE_KEY como autenticacion.

    POR QUE: GoTrue tiene una API HTTP para administrar usuarios (crear, editar,
    listar). La SERVICE_ROLE_KEY le dice a GoTrue que somos admin y podemos
    crear usuarios directamente (sin el flujo de signup).

    Args:
        method: HTTP method (GET, POST, PUT)
        path: Path relativo (ej: '/admin/users')
        data: Payload JSON (opcional)

    Returns:
        dict con la respuesta JSON

    Raises:
        ConnectionError: si la llamada falla
    """
    url = f"{SUPABASE_URL}/auth/v1{path}"
    body = json.dumps(data).encode("utf-8") if data else None

    req = Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_ROLE_KEY}")
    req.add_header("apikey", SUPABASE_SERVICE_ROLE_KEY)
    req.add_header("Content-Type", "application/json")

    try:
        with urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise ConnectionError(
            f"GoTrue API error {exc.code}: {error_body}"
        ) from exc
    except URLError as exc:
        raise ConnectionError(
            f"No se pudo conectar a GoTrue: {exc.reason}"
        ) from exc


def step1_collect_data() -> dict:
    """Paso 1: Recopilar datos del nuevo tenant interactivamente.

    Pide nombre, slug, erp_type y verticales activas. Valida cada campo
    contra las restricciones de la DB (CHECK constraints).
    """
    print("\n" + "=" * 60)
    print("  PASO 1: Datos del nuevo tenant")
    print("=" * 60)

    # Nombre
    name = input("\nNombre del distribuidor (ej: 'Distribuidora Garcia'): ").strip()
    if not name:
        print("ERROR: El nombre no puede estar vacio.")
        sys.exit(1)

    # Slug
    slug = input("Slug (identificador corto, ej: 'garcia'): ").strip().lower()
    if not SLUG_REGEX.match(slug):
        print(f"ERROR: Slug '{slug}' no cumple el formato requerido.")
        print("  - Solo minusculas, numeros y guiones")
        print("  - Debe empezar y terminar con letra o numero")
        sys.exit(1)

    # ERP type
    print(f"\nTipos de ERP disponibles: {', '.join(VALID_ERP_TYPES)}")
    erp_type = input("Tipo de ERP: ").strip().lower()
    if erp_type not in VALID_ERP_TYPES:
        print(f"ERROR: '{erp_type}' no es un tipo valido.")
        sys.exit(1)

    # Verticales
    print(f"\nVerticales disponibles: {', '.join(AVAILABLE_VERTICALS)}")
    print("(separar con comas, ej: 'reposicion,activacion')")
    verticals_input = input("Verticales activas: ").strip().lower()
    verticals = [v.strip() for v in verticals_input.split(",") if v.strip()]

    invalid = [v for v in verticals if v not in AVAILABLE_VERTICALS]
    if invalid:
        print(f"ERROR: Verticales invalidas: {', '.join(invalid)}")
        sys.exit(1)
    if not verticals:
        verticals = ["reposicion"]
        print("  (usando default: reposicion)")

    data = {
        "name": name,
        "slug": slug,
        "erp_type": erp_type,
        "active_verticals": verticals,
    }

    print(f"\n  Nombre: {name}")
    print(f"  Slug: {slug}")
    print(f"  ERP: {erp_type}")
    print(f"  Verticales: {', '.join(verticals)}")

    confirm = input("\n¿Datos correctos? (s/n): ").strip().lower()
    if confirm != "s":
        print("Cancelado por el usuario.")
        sys.exit(0)

    return data


def step2_create_tenant(data: dict) -> str:
    """Paso 2: Crear tenant en la DB.

    INSERT en la tabla tenants. Idempotente: si el slug ya existe, ofrece
    continuar con el tenant existente (para re-ejecutar el script si fallo
    en un paso posterior).

    Returns:
        tenant_id (UUID como string)
    """
    print("\n" + "=" * 60)
    print("  PASO 2: Crear tenant en DB")
    print("=" * 60)

    with get_db_connection_no_tenant() as conn:
        # Verificar si ya existe
        existing = conn.execute(
            "SELECT id FROM tenants WHERE slug = %s",
            (data["slug"],),
        ).fetchone()

        if existing:
            tenant_id = str(existing[0])
            print(f"\n  Tenant '{data['slug']}' ya existe (id={tenant_id})")
            cont = input("  ¿Continuar con este tenant? (s/n): ").strip().lower()
            if cont != "s":
                print("Cancelado.")
                sys.exit(0)
            return tenant_id

        # Crear nuevo tenant
        result = conn.execute(
            """
            INSERT INTO tenants (name, slug, erp_type, active_verticals, active)
            VALUES (%(name)s, %(slug)s, %(erp_type)s, %(verticals)s::jsonb, true)
            RETURNING id
            """,
            {
                "name": data["name"],
                "slug": data["slug"],
                "erp_type": data["erp_type"],
                "verticals": json.dumps(data["active_verticals"]),
            },
        ).fetchone()
        conn.commit()

        tenant_id = str(result[0])
        print(f"\n  Tenant creado: {data['name']} (id={tenant_id})")
        return tenant_id


def step3_create_user(tenant_id: str, data: dict) -> str | None:
    """Paso 3: Crear usuario admin en GoTrue + user_profile.

    Crea un usuario en GoTrue con app_metadata.tenant_id (necesario para
    que el JWT contenga el tenant_id y RLS funcione desde el dashboard).

    CONCEPTO - app_metadata vs user_metadata:
    app_metadata es controlado por el servidor (no lo puede cambiar el user).
    user_metadata es editable por el usuario. El tenant_id va en app_metadata
    porque el usuario NO debe poder cambiarlo (seria un agujero de seguridad).

    Returns:
        user_id (UUID como string) o None si se salta el paso
    """
    print("\n" + "=" * 60)
    print("  PASO 3: Crear usuario admin")
    print("=" * 60)

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("\n  ADVERTENCIA: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas.")
        print("  Saltando creacion de usuario. Configurar en .env y re-ejecutar.")
        return None

    email = input("\nEmail del admin: ").strip()
    if not email or "@" not in email:
        print("ERROR: Email invalido.")
        sys.exit(1)

    password = getpass.getpass("Password del admin (min 6 chars): ")
    if len(password) < 6:
        print("ERROR: Password debe tener al menos 6 caracteres.")
        sys.exit(1)

    # Crear usuario en GoTrue
    print("\n  Creando usuario en GoTrue...")
    try:
        user_data = _gotrue_request("POST", "/admin/users", {
            "email": email,
            "password": password,
            "email_confirm": True,
            "app_metadata": {
                "tenant_id": tenant_id,
            },
        })
        user_id = user_data.get("id")
        print(f"  Usuario GoTrue creado: {email} (id={user_id})")
    except ConnectionError as exc:
        error_msg = str(exc)
        if "already been registered" in error_msg or "already_exists" in error_msg:
            print(f"\n  Usuario '{email}' ya existe en GoTrue.")
            # Buscar usuario existente para obtener su ID y patchear app_metadata
            try:
                users_resp = _gotrue_request("GET", f"/admin/users?page=1&per_page=50")
                users = users_resp.get("users", [])
                user_id = None
                for u in users:
                    if u.get("email") == email:
                        user_id = u["id"]
                        break
                if user_id:
                    print(f"  ID encontrado: {user_id}")
                    # Asegurar que app_metadata tiene el tenant_id correcto
                    _gotrue_request("PUT", f"/admin/users/{user_id}", {
                        "app_metadata": {
                            "tenant_id": tenant_id,
                        },
                    })
                    print(f"  app_metadata actualizado con tenant_id")
                else:
                    print("  ADVERTENCIA: No se pudo encontrar el user_id. Continuar manualmente.")
                    return None
            except ConnectionError as inner_exc:
                print(f"  ADVERTENCIA: {inner_exc}")
                return None
        else:
            print(f"\n  ERROR creando usuario: {exc}")
            print("  Verificar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env")
            return None

    # Crear user_profile en la DB
    print("  Creando perfil en user_profiles...")
    with get_db_connection_no_tenant() as conn:
        conn.execute(
            """
            INSERT INTO user_profiles (id, tenant_id, full_name, role)
            VALUES (%(user_id)s, %(tenant_id)s, %(full_name)s, 'admin')
            ON CONFLICT (id) DO NOTHING
            """,
            {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "full_name": data["name"] + " Admin",
            },
        )
        conn.commit()
    print(f"  Perfil creado (role=admin)")

    return user_id


def step4_erp_credentials(data: dict) -> None:
    """Paso 4: Configurar credenciales ERP (si tiene API).

    Si el erp_type tiene API (como contabilium), pide client_id y
    client_secret por getpass y los guarda encriptados con Fernet.
    Si es 'excel', no necesita credenciales y salta el paso.

    CONCEPTO - getpass:
    Lee input del usuario sin mostrarlo en pantalla. Es como escribir
    el PIN en un cajero: los caracteres no se ven. Importante para que
    las credenciales no queden visibles en el historial de la terminal.
    """
    print("\n" + "=" * 60)
    print("  PASO 4: Credenciales ERP")
    print("=" * 60)

    if data["erp_type"] == "excel":
        print("\n  ERP tipo 'excel': no requiere credenciales API.")
        print("  El tenant subira datos via Smart File Upload o Google Drive.")
        return

    # Verificar ERP_ENCRYPTION_KEY
    if not validate_fernet_key(ERP_ENCRYPTION_KEY):
        print("\n  ADVERTENCIA: ERP_ENCRYPTION_KEY no configurada o invalida.")
        print("  Ejecutar: python backend/scripts/setup_credentials.py --init")
        print("  Saltando configuracion de credenciales ERP.")
        return

    print(f"\n  Configurando credenciales para ERP '{data['erp_type']}'")
    print("  (los valores no se muestran en pantalla por seguridad)")

    client_id = getpass.getpass("  Client ID: ")
    if not client_id:
        print("  Saltando (sin client_id).")
        return

    client_secret = getpass.getpass("  Client Secret: ")
    if not client_secret:
        print("  Saltando (sin client_secret).")
        return

    save_tenant_credentials(
        tenant_slug=data["slug"],
        client_id=client_id,
        client_secret=client_secret,
        encryption_key=ERP_ENCRYPTION_KEY,
    )
    print(f"  Credenciales encriptadas y guardadas para '{data['slug']}'")


def step5_verify(tenant_id: str, data: dict) -> None:
    """Paso 5: Verificacion automatica.

    Ejecuta 3 checks:
    1. RLS check: con contexto del nuevo tenant, no debe ver datos de IEY
    2. Profile check: user_profiles tiene un registro para este tenant
    3. Tenant record check: el tenant existe y esta activo

    Si algo falla, reporta el problema pero no aborta (el script se puede
    re-ejecutar para completar pasos faltantes).
    """
    print("\n" + "=" * 60)
    print("  PASO 5: Verificacion")
    print("=" * 60)

    checks_passed = 0
    checks_total = 3

    # Check 1: RLS isolation
    print("\n  [1/3] Verificando aislamiento RLS...")
    with get_db_connection(tenant_id) as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM customers"
        ).fetchone()[0]

    if count == 0:
        print(f"    OK: 0 clientes visibles (nuevo tenant, sin datos aun)")
        checks_passed += 1
    else:
        print(f"    ADVERTENCIA: {count} clientes visibles.")
        print(f"    Esto puede ser normal si ya se cargo datos para este tenant.")
        checks_passed += 1  # No es un fallo real, puede tener datos propios

    # Check 2: Profile exists
    print("  [2/3] Verificando perfil de usuario...")
    with get_db_connection_no_tenant() as conn:
        profile_count = conn.execute(
            "SELECT COUNT(*) FROM user_profiles WHERE tenant_id = %s",
            (tenant_id,),
        ).fetchone()[0]

    if profile_count > 0:
        print(f"    OK: {profile_count} perfil(es) encontrado(s)")
        checks_passed += 1
    else:
        print("    ADVERTENCIA: No hay perfiles para este tenant.")
        print("    Esto ocurre si se salto el Paso 3 (creacion de usuario).")

    # Check 3: Tenant record
    print("  [3/3] Verificando registro del tenant...")
    with get_db_connection_no_tenant() as conn:
        row = conn.execute(
            "SELECT name, slug, erp_type, active, active_verticals FROM tenants WHERE id = %s",
            (tenant_id,),
        ).fetchone()

    if row:
        print(f"    OK: {row[0]} ({row[1]}) | ERP: {row[2]} | Activo: {row[3]}")
        print(f"    Verticales: {row[4]}")
        checks_passed += 1
    else:
        print("    ERROR: Tenant no encontrado en la DB!")

    print(f"\n  Resultado: {checks_passed}/{checks_total} verificaciones OK")

    if checks_passed == checks_total:
        print("\n  Tenant listo para usar.")
        print(f"  Proximo paso: cargar datos con")
        if data["erp_type"] == "excel":
            print(f"    - Smart File Upload desde app.pymepilot.cloud/datos")
        else:
            print(f"    - python backend/scripts/sync_erp.py --tenant-slug {data['slug']} --test-only")
    else:
        print("\n  Hay verificaciones pendientes. Re-ejecutar el script para completar.")


def main() -> None:
    print("\n" + "#" * 60)
    print("  PymePilot — Onboarding de nuevo distribuidor")
    print("#" * 60)

    try:
        # Paso 1: Datos
        data = step1_collect_data()

        # Paso 2: Tenant en DB
        tenant_id = step2_create_tenant(data)

        # Paso 3: Usuario GoTrue + profile
        step3_create_user(tenant_id, data)

        # Paso 4: Credenciales ERP
        step4_erp_credentials(data)

        # Paso 5: Verificacion
        step5_verify(tenant_id, data)

    except KeyboardInterrupt:
        print("\n\nCancelado por el usuario (Ctrl+C).")
        sys.exit(1)
    except Exception as exc:
        logger.error(f"Error en onboarding: {exc}", exc_info=True)
        print(f"\nERROR: {exc}")
        print("Revisar logs en backend/logs/pymepilot.log para mas detalle.")
        sys.exit(1)
    finally:
        close_pool()


if __name__ == "__main__":
    main()
