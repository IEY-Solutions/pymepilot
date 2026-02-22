"""
Conector para la API REST de Contabilium (ERP).

QUE HACE ESTE ARCHIVO:
Se conecta a la API de Contabilium para LEER datos de clientes,
productos y comprobantes (facturas). NUNCA escribe en el ERP del cliente.

CONCEPTO CLAVE - Solo lectura:
Solo existe _get() para datos. No hay _post(), _put(), _delete().
authenticate() usa POST SOLO para obtener el Bearer token (OAuth2),
y va a /token, NO a endpoints de datos.

CONCEPTO CLAVE - Resiliencia:
No es solo "llamar a una API". Es manejar todos los casos de error:
- Token expirado (401): re-autenticar UNA sola vez
- Rate limit (429): esperar el tiempo indicado, maximo 60s
- Error temporal (500/502/503/504): backoff exponencial (1s, 2s, 4s)
- Error de red: reintentar con backoff
Maximo 3 reintentos totales. Despues: parar y esperar al dia siguiente.
"""

import time
from datetime import date

import requests

from backend.config.settings import (
    CONTABILIUM_API_URL,
    SYNC_MAX_RETRIES,
    SYNC_PAGE_SIZE,
    SYNC_RATE_LIMIT_DELAY,
)
from backend.engine.connectors.base import ERPConnector
from backend.engine.connectors.crypto import TenantCredentials
from backend.engine.core.logger import get_logger

logger = get_logger(__name__)


# --- Excepciones especificas ---

class ContabiliumError(Exception):
    """Error base para problemas con Contabilium."""


class AuthenticationError(ContabiliumError):
    """Credenciales invalidas o token expirado sin recuperacion."""


class APIError(ContabiliumError):
    """Error de la API (formato inesperado, servidor caido post-retries)."""


class RateLimitError(ContabiliumError):
    """Rate limit excedido despues de agotar reintentos."""


# La base URL de Contabilium. El /token esta en la raiz, los endpoints de datos en /api.
# CONTABILIUM_API_URL en settings tiene el valor base (ej: https://rest.contabilium.com/api)
# Para /token necesitamos la raiz sin /api.
_TOKEN_URL = CONTABILIUM_API_URL.replace('/api', '') + '/token'


class ContabiliumConnector(ERPConnector):
    """Conector de solo lectura para la API REST de Contabilium.

    Uso:
        with TenantCredentials.load('iey') as creds:
            connector = ContabiliumConnector(creds)
            connector.authenticate()
            customers, truncated = connector.fetch_customers()
    """

    def __init__(self, credentials: TenantCredentials) -> None:
        self._credentials = credentials
        self._access_token: str | None = None

    def authenticate(self) -> None:
        """Obtiene un Bearer token via OAuth2 client_credentials.

        Este es el UNICO POST que hace PymePilot. Va a /token, NO a endpoints de datos.

        LIMITACION CONOCIDA: La conversion bytearray->str necesaria para el POST HTTP
        genera un str inmutable que Python no puede limpiar deterministicamente. Vive
        hasta el proximo ciclo de GC. El bytearray original SI se limpia via
        TenantCredentials.__exit__. No hay alternativa viable: requests exige str.
        """
        # Convertir bytearray a str para el POST (requests exige str en form data)
        client_secret_str = self._credentials.get_secret_as_str()

        try:
            response = requests.post(
                _TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._credentials.client_id,
                    "client_secret": client_secret_str,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
            response.raise_for_status()
        except requests.exceptions.Timeout:
            logger.error("authenticate(): timeout conectando a Contabilium /token")
            raise
        except requests.exceptions.HTTPError:
            # NO loguear response.text (puede contener mensajes con datos sensibles)
            logger.error(f"authenticate(): HTTP {response.status_code}")
            raise
        except requests.exceptions.ConnectionError:
            logger.error("authenticate(): error de conexion a Contabilium")
            raise
        finally:
            del client_secret_str  # Elimina referencia al str (GC decide limpieza real)

        # Validar respuesta
        try:
            data = response.json()
        except ValueError:
            logger.error("authenticate(): respuesta no es JSON valido")
            raise

        if "access_token" not in data:
            logger.error("authenticate(): respuesta sin access_token")
            raise ValueError("Contabilium /token no retorno access_token")

        self._access_token = data["access_token"]
        # NO loguear el token. Solo confirmar exito:
        logger.info("authenticate(): token obtenido OK")

    def _get(self, endpoint: str, params: dict | None = None) -> dict | list:
        """GET con Bearer token, retry automatico, y manejo de errores.

        _auth_retried y _retries son locales por invocacion (NO atributos de instancia).
        401 NO incrementa _retries (es mecanismo de auth, no de disponibilidad).
        timeout=30 es explicito — sin el, requests espera para siempre.
        """
        _auth_retried = False
        _retries = 0

        while True:
            try:
                response = requests.get(
                    f"{CONTABILIUM_API_URL}/{endpoint}",
                    headers={"Authorization": f"Bearer {self._access_token}"},
                    params=params,
                    timeout=30,
                )
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                _retries += 1
                if _retries > SYNC_MAX_RETRIES:
                    raise APIError(f"GET {endpoint} fallo tras {SYNC_MAX_RETRIES} reintentos: {e}")
                delay = 2 ** (_retries - 1)  # 1s, 2s, 4s
                logger.warning(f"GET {endpoint} -> error de red (intento {_retries}). Retry en {delay}s")
                time.sleep(delay)
                continue

            logger.info(f"GET {endpoint} -> {response.status_code}")

            # 401: re-auth UNA sola vez por invocacion de _get()
            if response.status_code == 401:
                if not _auth_retried:
                    logger.info(f"GET {endpoint} -> 401. Re-autenticando...")
                    self.authenticate()
                    _auth_retried = True
                    continue
                raise AuthenticationError("Credenciales invalidas (401 persistente post re-auth)")

            # 429: respetar Retry-After, max 60s
            if response.status_code == 429:
                _retries += 1
                if _retries > SYNC_MAX_RETRIES:
                    raise RateLimitError(f"Rate limit excedido tras {SYNC_MAX_RETRIES} reintentos")
                try:
                    retry_after = max(1, min(int(response.headers.get("Retry-After", "30")), 60))
                except (ValueError, TypeError):
                    retry_after = 30  # Fallback si header es fecha HTTP o formato inesperado
                logger.warning(f"GET {endpoint} -> 429. Esperando {retry_after}s")
                time.sleep(retry_after)
                continue

            # 500/502/503/504: backoff exponencial
            if response.status_code in (500, 502, 503, 504):
                _retries += 1
                if _retries > SYNC_MAX_RETRIES:
                    raise APIError(f"Error servidor {response.status_code} tras {SYNC_MAX_RETRIES} reintentos")
                delay = 2 ** (_retries - 1)
                logger.warning(f"GET {endpoint} -> {response.status_code}. Retry en {delay}s")
                time.sleep(delay)
                continue

            # Otros errores (400, 403, 404): fatal, no reintentar
            response.raise_for_status()

            # Validar Content-Type ANTES de parsear JSON
            content_type = response.headers.get("Content-Type", "")
            if "application/json" not in content_type:
                raise APIError(
                    f"Respuesta no-JSON de {endpoint} (Content-Type: {content_type}). "
                    f"Verificar si Contabilium esta en mantenimiento."
                )

            try:
                return response.json()
            except (ValueError, Exception) as e:
                raise APIError(f"JSON invalido de {endpoint} (status {response.status_code})") from e

    def _get_paginated(
        self,
        endpoint: str,
        params: dict | None = None,
        max_pages: int = 100,
    ) -> tuple[list[dict], bool]:
        """Paginacion automatica con deteccion de formato.

        Retorna (items, truncated). truncated=True si se alcanzo max_pages.
        SAFEGUARD: max_pages=100 hardcoded. Para IEY (~500 clientes, pageSize 50)
        = 10 paginas. Safeguard da margen 10x.
        """
        all_items: list[dict] = []
        page = 1

        while page <= max_pages:
            request_params = {**(params or {}), "page": page, "pageSize": SYNC_PAGE_SIZE}
            data = self._get(endpoint, params=request_params)

            # Deteccion de formato (Contabilium puede devolver array directo o wrapper)
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                items = None
                for key in ("Items", "items", "Data", "data", "Results", "results"):
                    if key in data and isinstance(data[key], list):
                        items = data[key]
                        break
                if items is None:
                    raise APIError(
                        f"Formato de respuesta no reconocido para {endpoint}: "
                        f"keys={list(data.keys())}"
                    )
            else:
                raise APIError(f"Tipo inesperado de {endpoint}: {type(data)}")

            all_items.extend(items)

            # Condicion de salida: pagina vacia o parcial
            if len(items) == 0 or len(items) < SYNC_PAGE_SIZE:
                break
            time.sleep(SYNC_RATE_LIMIT_DELAY)  # Rate limiting respetuoso entre paginas
            page += 1

        truncated = page > max_pages
        if truncated:
            logger.warning(
                f"Limite de {max_pages} paginas alcanzado para {endpoint}. "
                f"Retornando {len(all_items)} registros acumulados. "
                f"Investigar si el tenant tiene mas datos de los esperados."
            )

        return all_items, truncated

    def fetch_customers(self) -> tuple[list[dict], bool]:
        """Obtiene clientes de Contabilium.

        Campos validados: ["Id", "RazonSocial"] — ambos necesarios para el upsert.
        "RazonSocial" mapea a customers.name (NOT NULL sin DEFAULT).
        Si Contabilium usa "Nombre" en vez de "RazonSocial", ajustar en Test 5.
        """
        raw, truncated = self._get_paginated("clientes/search")
        valid = self._validate_records(raw, "clientes", ["Id", "RazonSocial"])
        return valid, truncated

    def fetch_products(self) -> tuple[list[dict], bool]:
        """Obtiene productos de Contabilium.

        Campos validados: ["Id", "Nombre"] — ambos necesarios para el upsert.
        "Nombre" mapea a products.name (NOT NULL sin DEFAULT).
        """
        raw, truncated = self._get_paginated("conceptos/search")
        valid = self._validate_records(raw, "productos", ["Id", "Nombre"])
        return valid, truncated

    def fetch_orders(self, since_date: date | None = None) -> tuple[list[dict], bool]:
        """Obtiene comprobantes/facturas de Contabilium.

        Campos validados: ["Id", "Fecha"] — ambos necesarios para el upsert.
        "Fecha" mapea a orders.order_date (NOT NULL sin DEFAULT).
        Si since_date se provee, solo trae ordenes desde esa fecha.
        Formato de fecha [INFERIDO] — a confirmar en Test 5.
        """
        params: dict = {}
        if since_date is not None:
            params["fechaDesde"] = since_date.strftime("%Y-%m-%d")
        raw, truncated = self._get_paginated("comprobantes/search", params)
        valid = self._validate_records(raw, "ordenes", ["Id", "Fecha"])
        return valid, truncated

    def test_connection(self) -> bool:
        """Prueba la conexion: autenticar + leer 1 cliente.

        Si falla, lanza excepcion con detalle del error.
        """
        self.authenticate()
        # Intentar leer al menos 1 cliente como prueba
        data = self._get("clientes/search", params={"page": 1, "pageSize": 1})
        logger.info("test_connection(): conexion a Contabilium OK")
        return True

    def __reduce__(self):
        raise TypeError("ContabiliumConnector no es serializable")

    def __getstate__(self):
        raise TypeError("ContabiliumConnector no es serializable")
