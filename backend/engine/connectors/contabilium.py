"""
Conector para la API REST de Contabilium (ERP).

QUE HACE ESTE ARCHIVO:
Se conecta a la API de Contabilium para LEER datos de clientes,
productos y comprobantes (facturas/cotizaciones). NUNCA escribe en el ERP.

CONCEPTO CLAVE - Solo lectura:
Solo existe _get() para datos. No hay _post(), _put(), _delete().
authenticate() usa POST SOLO para obtener el Bearer token (OAuth2),
y va a /token, NO a endpoints de datos.

CONCEPTO CLAVE - Filtro por punto de venta:
Para IEY, solo sincronizamos comprobantes del PV 0003 (mayorista).
Esto se hace con el parametro 'filtro' de comprobantes/search y un
post-filtro por Numero (ej: '0003-00000001'). Asi evitamos descargar
datos de canales minoristas (MercadoLibre, TiendaNube) que no nos interesan.

CONCEPTO CLAVE - Resiliencia:
No es solo "llamar a una API". Es manejar todos los casos de error:
- Token expirado (401): re-autenticar UNA sola vez
- Rate limit (429): esperar el tiempo indicado, maximo 60s
- Error temporal (500/502/503/504): backoff exponencial (1s, 2s, 4s)
- Error de red: reintentar con backoff
Maximo 3 reintentos totales. Despues: parar y esperar al dia siguiente.
"""

import socket
import time
from datetime import date, datetime

import requests
import urllib3.util.connection as urllib3_cn
from requests.adapters import HTTPAdapter

from backend.config.settings import (
    CONTABILIUM_API_URL,
    SYNC_MAX_RETRIES,
    SYNC_PAGE_SIZE,
    SYNC_RATE_LIMIT_DELAY,
)
from backend.engine.connectors.base import ERPConnector
from backend.engine.connectors.crypto import TenantCredentials
from backend.engine.core.logger import get_logger, sanitize_text

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


class IPv4HTTPAdapter(HTTPAdapter):
    """Adaptador HTTP que fuerza conexiones IPv4 (AF_INET).

    POR QUE EXISTE: El VPS (Contabo) prefiere IPv6 por defecto, pero
    Contabilium solo tiene whitelisted la IPv4 (173.249.9.56) en Cloudflare.
    Sin esto, urllib3 resuelve DNS a IPv6, Cloudflare devuelve 403.

    COMO FUNCIONA: urllib3 usa allowed_gai_family() para decidir que familia
    de direcciones pasar a getaddrinfo(). Por defecto retorna AF_UNSPEC
    (ambas). Este adapter la reemplaza por AF_INET (solo IPv4).

    ALCANCE: Aunque el parche es a nivel modulo de urllib3, en nuestro backend
    solo ContabiliumConnector usa requests/urllib3. psycopg3 tiene su propio
    mecanismo de conexion, no se ve afectado.
    """

    def init_poolmanager(self, connections: int, maxsize: int, block: bool = False, **kwargs: object) -> None:
        urllib3_cn.allowed_gai_family = lambda: socket.AF_INET
        super().init_poolmanager(connections, maxsize, block=block, **kwargs)


# --- Filtro de comprobantes mayorista ---
# Solo se sincronizan comprobantes cuyo Numero empiece con este prefijo.
# Para IEY: "0003-" = punto de venta 3 (mayorista).
# TODO: Mover a erp_config per-tenant cuando haya segundo tenant.
_PV_MAYORISTA = '0003-'

# Tipos de comprobante que representan ventas.
# FCA/FCB = facturas (A y B). COT = cotizaciones (ventas no facturadas).
# NCA/NCB = notas de credito (devoluciones) → se EXCLUYEN.
_COMPROBANTE_TIPOS_VENTA = {'FCA', 'FCB', 'COT'}


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
        self._session = requests.Session()
        self._session.mount('https://', IPv4HTTPAdapter())
        # Solo HTTPS — no montar http:// para prevenir envio
        # accidental de credenciales sin encriptar.

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
            response = self._session.post(
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
                response = self._session.get(
                    f"{CONTABILIUM_API_URL}/{endpoint}",
                    headers={"Authorization": f"Bearer {self._access_token}"},
                    params=params,
                    timeout=30,
                )
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                _retries += 1
                if _retries > SYNC_MAX_RETRIES:
                    raise APIError(f"GET {endpoint} fallo tras {SYNC_MAX_RETRIES} reintentos: {sanitize_text(str(e))}")
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
        limit: int | None = None,
    ) -> tuple[list[dict], bool]:
        """Paginacion automatica con deteccion de formato.

        Retorna (items, truncated). truncated=True si se alcanzo max_pages.
        Si limit se provee, deja de paginar apenas tenga suficientes registros
        y retorna exactamente esa cantidad (no descarga paginas de mas).
        SAFEGUARD: max_pages=100 hardcoded. Para IEY (~5000 clientes, pageSize 50)
        = 100 paginas. Safeguard evita loops infinitos.
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

            # Si tenemos suficientes registros, cortar y retornar
            if limit is not None and len(all_items) >= limit:
                all_items = all_items[:limit]
                return all_items, False

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

    def fetch_customers(
        self,
        limit: int | None = None,
        client_ids: set[str] | None = None,
    ) -> tuple[list[dict], bool]:
        """Obtiene clientes de Contabilium.

        Si client_ids se provee, descarga SOLO esos clientes via GET individual
        (clientes/?id=XXX). Esto evita descargar 5000+ clientes cuando solo
        necesitamos ~138 del canal mayorista.

        Si client_ids es None, descarga todos (paginado). Util para sync full.
        """
        if client_ids:
            # Modo dirigido: solo clientes especificos (mayorista)
            raw: list[dict] = []
            for cid in client_ids:
                try:
                    client = self._get("clientes/", params={"id": cid})
                    if isinstance(client, dict):
                        raw.append(client)
                    time.sleep(SYNC_RATE_LIMIT_DELAY)
                except Exception as e:
                    logger.warning(f"fetch_customers(): no se pudo obtener cliente id={cid}: {sanitize_text(str(e))}")
            truncated = False
            logger.info(
                f"fetch_customers(): {len(raw)} clientes obtenidos por ID "
                f"(de {len(client_ids)} solicitados)"
            )
        else:
            # Modo completo: todos los clientes (paginado)
            raw, truncated = self._get_paginated("clientes/search", limit=limit)

        valid = self._validate_records(raw, "clientes", ["Id", "RazonSocial"])
        return valid, truncated

    def fetch_products(self, limit: int | None = None) -> tuple[list[dict], bool]:
        """Obtiene productos de Contabilium.

        Campos validados: ["Id", "Nombre"] — ambos necesarios para el upsert.
        "Nombre" mapea a products.name (NOT NULL sin DEFAULT).
        Si limit se provee, corta la paginacion apenas tenga suficientes.
        """
        raw, truncated = self._get_paginated("conceptos/search", limit=limit)
        valid = self._validate_records(raw, "productos", ["Id", "Nombre"])
        return valid, truncated

    def fetch_orders(self, since_date: date | None = None, limit: int | None = None) -> tuple[list[dict], bool]:
        """Obtiene comprobantes de venta del punto de venta mayorista.

        Endpoint: comprobantes/search con filtro por PV mayorista (_PV_MAYORISTA).
        Solo incluye tipos de venta (FCA, FCB, COT). Excluye notas de credito
        (NCA, NCB) porque son devoluciones, no ventas.

        Cada comprobante del search NO incluye Items (productos). Para obtenerlos,
        se hace un GET adicional a comprobantes/?id=XXX por cada comprobante.

        Transforma los campos al formato que _upsert_orders en sync.py espera:
        - 'Id' <- str(Id del comprobante)
        - 'Fecha' <- FechaEmision parseada (ISO 2025-03-12T00:00:00 -> date)
        - 'Total' <- ImporteTotalNeto parseado ("47.341,01" -> float)
        - 'Cliente' <- str(IdCliente) (ID interno Contabilium = external_id)
        - 'Items' <- del GetById, transformados a formato Concepto/Cantidad/etc.
        """
        params: dict = {
            'fechaDesde': (since_date or date(2020, 1, 1)).strftime("%Y-%m-%d"),
            'fechaHasta': date.today().strftime("%Y-%m-%d"),
            'filtro': _PV_MAYORISTA,
        }

        # Descargar comprobantes del search (todos para luego filtrar por tipo)
        raw, truncated = self._get_paginated("comprobantes/search", params)
        logger.info(f"fetch_orders(): {len(raw)} comprobantes obtenidos del search (filtro={_PV_MAYORISTA})")

        # Post-filtro de seguridad: verificar que el Numero empieza con el PV
        # correcto (por si 'filtro' matcheo razon social u otro campo)
        pv_filtered = [
            c for c in raw
            if str(c.get('Numero', '')).startswith(_PV_MAYORISTA)
        ]
        if len(pv_filtered) < len(raw):
            logger.info(
                f"fetch_orders(): {len(raw) - len(pv_filtered)} comprobantes descartados "
                f"(Numero no empieza con '{_PV_MAYORISTA}')"
            )

        # Filtrar por tipo: solo ventas, no notas de credito
        sales = [c for c in pv_filtered if c.get('TipoFc') in _COMPROBANTE_TIPOS_VENTA]
        excluded = len(pv_filtered) - len(sales)
        if excluded:
            logger.info(
                f"fetch_orders(): {excluded} comprobantes excluidos "
                f"(notas de credito u otros tipos no-venta)"
            )

        # Aplicar limit DESPUES de los filtros
        if limit is not None:
            sales = sales[:limit]

        # Transformar y enriquecer cada comprobante con sus Items
        orders: list[dict] = []
        for comp in sales:
            comp_id = comp.get('Id')

            # GET detalle para obtener Items (productos del comprobante)
            detail = self._get("comprobantes/", params={"id": comp_id})
            time.sleep(SYNC_RATE_LIMIT_DELAY)

            # Transformar Items al formato que sync.py espera
            items: list[dict] = []
            for item in (detail.get('Items') or []):
                qty = item.get('Cantidad', 0) or 0
                unit_price = item.get('PrecioUnitario', 0) or 0
                items.append({
                    'Concepto': {
                        'Id': str(item.get('IdConcepto', '')),
                        'Nombre': item.get('Concepto', ''),
                    },
                    'Cantidad': qty,
                    'PrecioUnitario': unit_price,
                    'Total': qty * unit_price,
                })

            # Transformar comprobante al formato que sync.py espera
            orders.append({
                'Id': str(comp_id),
                'Fecha': self._parse_iso_date(comp.get('FechaEmision', '')),
                'Total': self._parse_argentine_money(comp.get('ImporteTotalNeto', '')),
                'Cliente': str(comp.get('IdCliente', '')),
                'Items': items,
            })

        valid = self._validate_records(orders, "ordenes", ["Id", "Fecha"])
        return valid, truncated

    @staticmethod
    def _parse_iso_date(date_str: str) -> date | None:
        """Parsea fecha ISO (2025-03-12T00:00:00) a date de Python.

        Contabilium devuelve FechaEmision en formato ISO con hora.
        PostgreSQL necesita un objeto date (psycopg3 lo serializa a YYYY-MM-DD).
        """
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str).date()
        except ValueError:
            logger.warning(f"No se pudo parsear fecha ISO: '{date_str}'")
            return None

    @staticmethod
    def _parse_argentine_money(money_str: str) -> float | None:
        """Parsea monto en formato argentino '371.708,00' a float.

        Contabilium usa punto como separador de miles y coma como decimal:
        '371.708,00' -> 371708.00
        """
        if not money_str:
            return None
        try:
            clean = str(money_str).replace('.', '').replace(',', '.')
            return float(clean)
        except (ValueError, TypeError):
            logger.warning(f"No se pudo parsear monto: '{money_str}'")
            return None

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
