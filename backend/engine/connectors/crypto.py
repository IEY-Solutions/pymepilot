"""
Utilidades de encriptacion para credenciales ERP.

QUE HACE ESTE ARCHIVO:
Protege las credenciales de cada tenant (como el token de la API de
Contabilium) usando encriptacion Fernet (AES-128-CBC + HMAC).

CONCEPTO CLAVE - Fernet:
Es un esquema de encriptacion simetrica: la misma clave (ERP_ENCRYPTION_KEY)
sirve para encriptar y desencriptar. La clave vive en .env, los datos
encriptados viven en la DB. Ambos tienen que ser comprometidos al mismo
tiempo para que haya riesgo.

CONCEPTO CLAVE - Context Manager (TenantCredentials):
Las credenciales desencriptadas se usan dentro de un bloque "with".
Al salir del bloque, la memoria se sobreescribe con ceros automaticamente.
Es como un prestamo de biblioteca: sacas el libro, lo usas, y al salir
se devuelve automaticamente.

    with TenantCredentials.load('iey') as creds:
        connector = ContabiliumConnector(creds)
        connector.fetch_customers()
    # Aca la memoria ya esta limpia, no importa si hubo error
"""

import binascii
import json

from cryptography.fernet import Fernet, InvalidToken

from backend.engine.core.logger import get_logger
from backend.engine.db.connection import get_db_connection, get_db_connection_no_tenant

logger = get_logger(__name__)


def validate_fernet_key(key: str) -> bool:
    """Valida que key es una Fernet key funcional.

    Paso 1: Verificar formato rapido (44 chars, charset base64url).
    Paso 2: Intentar Fernet(key.encode()). Si lanza ValueError o
            binascii.Error → la key es invalida.

    Por que Paso 2: una string de 44 chars base64 validos puede tener
    padding incorrecto o decodificar a != 32 bytes. Solo Fernet() lo detecta.
    """
    if not isinstance(key, str) or len(key) != 44:
        return False
    try:
        Fernet(key.encode('utf-8'))
        return True
    except (ValueError, binascii.Error):
        return False


def encrypt_secret(plaintext: str | bytes | bytearray, encryption_key: str) -> str:
    """Encripta un secreto. Acepta str, bytes, o bytearray como input.
    Retorna ciphertext como str (no es sensible, es seguro almacenarlo).

    LIMITACION DOCUMENTADA: bytes(bytearray) crea una copia inmutable en memoria.
    Esa copia vive hasta el siguiente ciclo de GC. Es la misma limitacion que la
    conversion bytearray->str en authenticate(). El bytearray original se limpia
    en el caller via try/finally (ver rotate_encryption_key, paso 3).
    """
    if isinstance(plaintext, str):
        plaintext_bytes = plaintext.encode('utf-8')
    elif isinstance(plaintext, bytearray):
        plaintext_bytes = bytes(plaintext)  # copia inmutable necesaria para Fernet
    else:
        plaintext_bytes = plaintext  # ya es bytes

    f = Fernet(encryption_key.encode('utf-8'))
    return f.encrypt(plaintext_bytes).decode('utf-8')


def decrypt_secret(ciphertext: str, encryption_key: str) -> bytearray:
    """Desencripta un secreto. Retorna bytearray (NO str) para permitir
    limpieza explicita de memoria.

    El caller es responsable de limpiar con:
        secret[:] = b'\\x00' * len(secret)
    al terminar de usar el valor.
    """
    f = Fernet(encryption_key.encode('utf-8'))
    decrypted_bytes = f.decrypt(ciphertext.encode('utf-8'))
    # Convertir a bytearray para permitir sobreescritura explicita
    result = bytearray(decrypted_bytes)
    return result


def save_tenant_credentials(
    tenant_slug: str,
    client_id: str,
    client_secret: str,
    encryption_key: str,
) -> None:
    """Guarda credenciales encriptadas en tenants.erp_config.
    client_secret se encripta antes de guardarse. Nunca se almacena en plano.
    """
    ciphertext = encrypt_secret(client_secret, encryption_key)

    erp_config = json.dumps({
        'client_id': client_id,
        'client_secret_encrypted': ciphertext,
    })

    with get_db_connection_no_tenant() as conn:
        conn.execute(
            "UPDATE tenants SET erp_config = %(config)s::jsonb WHERE slug = %(slug)s",
            {'config': erp_config, 'slug': tenant_slug},
        )
        conn.commit()

    logger.info(f"Credenciales guardadas para tenant '{tenant_slug}' (encriptadas)")


class TenantCredentials:
    """Contenedor seguro de credenciales desencriptadas.

    NUNCA usar dict para credenciales. Este objeto:
    - Almacena client_secret como bytearray internamente
    - Implementa __enter__/__exit__ (context manager)
    - Al salir del scope, sobreescribe la memoria con ceros automaticamente
    - No es copiable (raises TypeError en __copy__)
    - __repr__ y __str__ retornan '***REDACTED***'

    Uso obligatorio:
        with TenantCredentials.load('iey') as creds:
            connector = ContabiliumConnector(creds)
            connector.fetch_customers()
        # Al salir del with, la memoria se limpia automaticamente
    """

    @classmethod
    def load(cls, tenant_slug: str) -> 'TenantCredentials':
        """Carga y desencripta credenciales desde la DB.

        ORDEN DE OPERACIONES (estricto, no reordenable):
        Paso 1: FETCH DE DB — Solo datos encriptados viajan.
        Paso 2: DECRYPT — A partir de aca hay material sensible en memoria.
        Paso 3: CONSTRUCCION — try/finally empieza DESPUES del decrypt.
        """
        from backend.config.settings import ERP_ENCRYPTION_KEY

        # Paso 1: fetch de DB (seguro, solo datos encriptados)
        with get_db_connection_no_tenant() as conn:
            row = conn.execute(
                "SELECT erp_config FROM tenants WHERE slug = %s AND active = true",
                (tenant_slug,)
            ).fetchone()

        if row is None:
            raise ValueError(f"Tenant '{tenant_slug}' no encontrado o inactivo")

        erp_config = row[0]
        if not erp_config or 'client_id' not in erp_config or 'client_secret_encrypted' not in erp_config:
            raise ValueError(
                f"Tenant '{tenant_slug}' no tiene credenciales configuradas. "
                f"Ejecutar: python backend/scripts/setup_credentials.py --tenant-slug {tenant_slug}"
            )

        client_id = erp_config['client_id']
        ciphertext = erp_config['client_secret_encrypted']

        # Paso 2: decrypt (a partir de aca hay material sensible)
        secret_bytes = decrypt_secret(ciphertext, ERP_ENCRYPTION_KEY)

        # Paso 3: construccion (try/finally empieza ACA, despues del decrypt)
        try:
            obj = cls.__new__(cls)
            obj._client_id = client_id
            obj._secret = secret_bytes  # asignacion directa, NO copia
            return obj
        except Exception:
            secret_bytes[:] = b'\x00' * len(secret_bytes)  # limpieza antes de propagar
            raise

    @property
    def client_id(self) -> str:
        """Client ID (no sensible, puede ser str)."""
        return self._client_id

    @property
    def client_secret_bytes(self) -> bytearray:
        """Client secret como bytearray. Solo convertir a str en el
        instante exacto del request HTTP."""
        return self._secret

    def get_secret_as_str(self) -> str:
        """Convierte el secret a str para el POST HTTP.

        LIMITACION CONOCIDA: la conversion genera un str inmutable que Python
        no puede limpiar deterministicamente. Vive hasta el proximo ciclo de GC.
        El bytearray original SI se limpia via __exit__.
        Solo usar en el instante exacto del request HTTP."""
        return self._secret.decode('utf-8')

    def __enter__(self) -> 'TenantCredentials':
        """SOLO retorna self. Sin logica adicional.
        Si __enter__ pudiera fallar, __exit__ no se llamaria
        y el bytearray nunca se limpiaria."""
        return self

    def __exit__(self, *args) -> None:
        """Sobreescribe bytearray con ceros. Limpieza garantizada.
        Usa getattr para ser defensivo: si load() fallo parcialmente
        entre __new__() y la asignacion de _secret, el atributo no existe."""
        secret = getattr(self, '_secret', None)
        if secret is not None:
            secret[:] = b'\x00' * len(secret)

    def __repr__(self) -> str:
        return 'TenantCredentials(***REDACTED***)'

    def __str__(self) -> str:
        return '***REDACTED***'

    def __copy__(self):
        raise TypeError("TenantCredentials no es copiable")

    def __deepcopy__(self, memo):
        raise TypeError("TenantCredentials no es copiable")

    def __reduce__(self):
        raise TypeError("TenantCredentials no es serializable")

    def __getstate__(self):
        raise TypeError("TenantCredentials no es serializable")


def rotate_encryption_key(old_key: str, new_key: str) -> None:
    """Re-encripta TODAS las credenciales con la nueva clave.

    ORDEN DE OPERACIONES:
    Paso 0: Validar new_key ANTES de abrir transaccion.
    Paso 1: Validar old_key.
    Paso 2: Abrir transaccion (tenants NO tiene FORCE RLS).
    Paso 3: Para cada tenant: decrypt con old_key, encrypt con new_key, UPDATE.
    Paso 4: COMMIT (o ROLLBACK si cualquier paso falla).

    Transaccion atomica. Si falla, rollback total.
    """
    # Paso 0: validar new_key ANTES de abrir transaccion
    if not validate_fernet_key(new_key):
        raise ValueError("new_key no es una clave Fernet valida")

    # Paso 1: validar old_key
    if not validate_fernet_key(old_key):
        raise ValueError("old_key no es una clave Fernet valida")

    # Paso 2: abrir transaccion
    with get_db_connection_no_tenant() as conn:
        with conn.transaction():
            rows = conn.execute(
                "SELECT id, slug, erp_config FROM tenants WHERE erp_config IS NOT NULL"
            ).fetchall()

            rotated_count = 0
            for row in rows:
                tenant_id, tenant_slug, erp_config = row[0], row[1], row[2]
                ciphertext = erp_config.get('client_secret_encrypted')
                if not ciphertext:
                    continue

                # Paso 3: decrypt con old_key, encrypt con new_key
                try:
                    secret_bytes = decrypt_secret(ciphertext, old_key)
                except InvalidToken:
                    raise ValueError(
                        f"Tenant {tenant_slug}: datos indescifrables con la clave actual. "
                        f"Verificar si hubo rotacion previa incompleta."
                    )

                try:
                    new_ciphertext = encrypt_secret(secret_bytes, new_key)
                finally:
                    # Limpieza de bytearray por iteracion
                    secret_bytes[:] = b'\x00' * len(secret_bytes)

                # UPDATE con new_ciphertext (str, no sensible)
                erp_config['client_secret_encrypted'] = new_ciphertext
                conn.execute(
                    "UPDATE tenants SET erp_config = %s::jsonb WHERE id = %s",
                    (json.dumps(erp_config), tenant_id),
                )
                rotated_count += 1

            # Paso 4: COMMIT automatico al salir de conn.transaction()

    logger.info(f"Rotacion de clave completada: {rotated_count} tenant(s) re-encriptados")
