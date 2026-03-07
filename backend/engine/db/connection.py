"""
Conexion a PostgreSQL con connection pooling y tenant context.

QUE HACE ESTE ARCHIVO:
Es el "puente" entre nuestro codigo Python y la base de datos PostgreSQL.
Mantiene un "pool" (grupo) de conexiones abiertas para no tener que
reconectarse cada vez que hacemos una consulta.

CONCEPTO CLAVE - Context Manager (el "with"):
En Python, "with" es una forma segura de usar recursos que necesitan
cerrarse al terminar. Ejemplo:
    with get_db_connection(tenant_id) as conn:
        conn.execute("SELECT ...")
    # Al salir del "with", la conexion se devuelve al pool automaticamente

CONCEPTO CLAVE - Tenant Context:
Antes de hacer cualquier consulta, le decimos a PostgreSQL "estoy trabajando
con el tenant X". Asi, las politicas RLS filtran automaticamente los datos
y solo vemos los del tenant correcto.

NOTA: load_dotenv() se ejecuta en los ENTRY POINTS (scripts), NO aca.
"""

from contextlib import contextmanager
from uuid import UUID

import psycopg
from psycopg_pool import ConnectionPool

from backend.config.settings import (
    DATABASE_HOST,
    DATABASE_NAME,
    DATABASE_PASSWORD,
    DATABASE_PORT,
    DATABASE_USER,
)
from backend.engine.core.logger import get_logger

logger = get_logger(__name__)

# Pool global de conexiones (singleton)
_pool: ConnectionPool | None = None


def _build_conninfo() -> str:
    """
    Construye el string de conexion a PostgreSQL desde settings.py.

    Usa settings.py como unica fuente de verdad para la configuracion de DB.
    Antes leia os.getenv() directamente, duplicando defaults con settings.py.
    Fix del incidente 7 de marzo: una sola fuente de verdad.
    """
    return (
        f"host={DATABASE_HOST} port={DATABASE_PORT} dbname={DATABASE_NAME} "
        f"user={DATABASE_USER} password={DATABASE_PASSWORD}"
    )


def _reset_connection(conn: psycopg.Connection) -> None:
    """Limpia tenant context cuando una conexion se devuelve al pool.

    RESET produce empty string (''), no NULL. La policy RLS hace:
        current_setting('app.tenant_id')::uuid
    Cast de '' a uuid FALLA → query denegada. Comportamiento FAIL-CLOSED:
    si el reset funciono, ninguna query pasa sin set_tenant_context() nuevo.

    conn.rollback() primero: si la conexion tiene una transaccion abierta
    (estado INTRANS), el RESET falla. rollback() la limpia.

    Si el RESET falla (conexion rota), psycopg_pool descarta la conexion
    automaticamente y crea una nueva. No hay riesgo de leak.
    """
    conn.rollback()
    conn.execute("RESET app.tenant_id")
    conn.commit()


def get_pool() -> ConnectionPool:
    """
    Obtiene el pool de conexiones (lo crea si no existe).

    El pool es un "singleton": se crea una sola vez y se reutiliza.
    Esto es importante porque crear pools es costoso en recursos.
    """
    global _pool

    if _pool is None:
        conninfo = _build_conninfo()

        _pool = ConnectionPool(
            conninfo=conninfo,
            min_size=2,       # Minimo 2 conexiones siempre abiertas
            max_size=10,      # Maximo 10 conexiones simultaneas
            timeout=30.0,     # Esperar max 30 seg para obtener conexion
            max_idle=300.0,   # Cerrar conexion si esta ociosa >5 minutos
            num_workers=3,    # Workers internos para mantenimiento del pool
            reset=_reset_connection,  # Limpiar tenant context al devolver al pool
        )

        logger.info("Database connection pool created")

    return _pool


@contextmanager
def get_db_connection(tenant_id: UUID | str):
    """
    Obtiene una conexion del pool con el tenant context configurado.

    USO:
        with get_db_connection(tenant_id) as conn:
            result = conn.execute("SELECT * FROM customers").fetchall()
            # RLS filtra automaticamente: solo devuelve datos de este tenant

    Args:
        tenant_id: UUID del tenant (puede ser string o UUID)

    Yields:
        psycopg.Connection con tenant context seteado
    """
    pool = get_pool()
    tenant_id_str = str(tenant_id)

    try:
        with pool.connection() as conn:
            # Configurar el tenant context ANTES de cualquier query
            # Esto hace que las RLS policies filtren automaticamente
            conn.execute(
                "SELECT set_tenant_context(%s::uuid)",
                (tenant_id_str,)
            )
            # Commit explicito: cierra la transaccion implicita que abrio
            # psycopg3 al ejecutar el SELECT. Esto deja la conexion en estado
            # limpio (IDLE) antes de pasarla al caller. Sin esto, funciona
            # igual (set_config SESSION persiste sin commit), pero depende
            # de un detalle de implementacion de PostgreSQL.
            conn.commit()

            logger.debug(
                "DB connection acquired with tenant context",
                extra={"tenant_id": tenant_id_str}
            )

            yield conn

    # P-02 FIX: Capturar psycopg.Error (clase padre) en vez de solo OperationalError.
    # psycopg3 puede lanzar InterfaceError (conexion muerta), DatabaseError
    # (constraint violation en set_tenant_context), etc. Sin esto, esos errores
    # se propagan sin logging y cuesta diagnosticar que paso.
    except psycopg.Error as e:
        logger.error(f"Database connection error: {e}", exc_info=True)
        raise


@contextmanager
def get_db_connection_no_tenant():
    """
    Obtiene una conexion SIN tenant context.

    USAR SOLO para operaciones que no son especificas de un tenant:
    - Listar todos los tenants
    - Operaciones de admin/super_admin
    - Migraciones

    NUNCA usar para acceder a datos de clientes, ordenes, predicciones, etc.
    """
    pool = get_pool()

    try:
        with pool.connection() as conn:
            logger.debug("DB connection acquired WITHOUT tenant context")
            yield conn

    # P-02 FIX: Mismo cambio que en get_db_connection (ver arriba).
    except psycopg.Error as e:
        logger.error(f"Database connection error: {e}", exc_info=True)
        raise


def close_pool():
    """Cierra el pool de conexiones (para cleanup al terminar el programa)."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        logger.info("Database connection pool closed")


def get_tenant_id_by_slug(slug: str) -> str:
    """
    Obtiene el UUID de un tenant por su slug.

    Args:
        slug: Identificador corto del tenant (ej: "iey")

    Returns:
        UUID del tenant como string

    Raises:
        ValueError: Si el tenant no existe o esta inactivo
    """
    pool = get_pool()

    with pool.connection() as conn:
        result = conn.execute(
            "SELECT id FROM tenants WHERE slug = %s AND active = true",
            (slug,)
        ).fetchone()

    if result is None:
        raise ValueError(f"Tenant con slug '{slug}' no encontrado o inactivo")

    return str(result[0])
