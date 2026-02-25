"""
Clase abstracta para conectores ERP.

QUE HACE ESTE ARCHIVO:
Define el "contrato" que todo conector ERP debe cumplir.
Es un molde con 4 metodos de LECTURA obligatorios.

CONCEPTO CLAVE - Abstract Base Class (ABC):
Es como un formulario con campos obligatorios. Si creas un conector
nuevo (ej: ExcelConnector) y te olvidas de implementar alguno de estos
4 metodos, Python te avisa con un error al intentar instanciarlo.

SEGURIDAD - SOLO LECTURA:
Este contrato SOLO define metodos de lectura (fetch_*, test_connection).
No hay _post(), _put(), _delete(). Es fisicamente imposible que un
conector escriba en el ERP del cliente a traves de esta interfaz.
"""

from abc import ABC, abstractmethod
from datetime import date

from backend.engine.core.logger import get_logger

logger = get_logger(__name__)


class ERPConnector(ABC):
    """Contrato base para conectores ERP. Solo metodos de LECTURA.

    Subclases implementadas:
    - ContabiliumConnector: API REST de Contabilium
    - ExcelConnector: archivos Excel (.xlsx)

    Cada metodo fetch_* retorna (list[dict], bool):
    - list[dict]: registros validados (post _validate_records)
    - bool: True si los datos fueron truncados (alcanzó limite de paginas)
    """

    @abstractmethod
    def test_connection(self) -> bool:
        """Verifica que la conexion al ERP funciona.

        Retorna True si la conexion es exitosa.
        Lanza excepcion con detalle si falla.
        """

    @staticmethod
    def _validate_records(
        records: list[dict],
        entity: str,
        required_fields: list[str],
    ) -> list[dict]:
        """Filtra registros que no tienen los campos obligatorios para el upsert.

        Un registro con Id=None o Id='' causa constraint violation en el upsert,
        que dispara ROLLBACK de TODA la transaccion. Con validacion previa, el
        registro malo se descarta y se loguea, el resto del sync continua normal.

        Usa 'is None or == ""' (no truthiness) para no descartar valores como 0.
        """
        valid = []
        for record in records:
            missing = [f for f in required_fields if record.get(f) is None or record.get(f) == '']
            if missing:
                eid = record.get('Id', record.get('id', 'desconocido'))
                logger.warning(
                    f"_validate_records: {entity} descartado "
                    f"(external_id={eid}, campos faltantes: {missing})"
                )
                continue
            valid.append(record)

        discarded = len(records) - len(valid)
        if discarded > 0:
            logger.info(
                f"_validate_records: {entity} — {len(valid)} validos, "
                f"{discarded} descartados de {len(records)} totales"
            )

        return valid

    @abstractmethod
    def fetch_customers(
        self,
        limit: int | None = None,
        client_ids: set[str] | None = None,
    ) -> tuple[list[dict], bool]:
        """Obtiene clientes del ERP.

        Args:
            limit: Si se provee, retorna como maximo esta cantidad.
            client_ids: Si se provee, solo descarga estos clientes especificos
                (por external_id). Util para no descargar 5000+ clientes
                cuando solo necesitamos los del canal mayorista (~138).
                Si es None, descarga todos.

        Retorna:
            tuple[list[dict], bool]: (clientes, truncated)
        """

    @abstractmethod
    def fetch_products(self, limit: int | None = None) -> tuple[list[dict], bool]:
        """Obtiene todos los productos del ERP.

        Args:
            limit: Si se provee, retorna como maximo esta cantidad.

        Retorna:
            tuple[list[dict], bool]: (productos, truncated)
        """

    @abstractmethod
    def fetch_orders(self, since_date: date | None = None, limit: int | None = None) -> tuple[list[dict], bool]:
        """Obtiene ordenes/comprobantes del ERP.

        Args:
            since_date: Si se provee, solo trae ordenes desde esa fecha.
                       Si es None, trae todas (sync full).
            limit: Si se provee, retorna como maximo esta cantidad.

        Retorna:
            tuple[list[dict], bool]: (ordenes, truncated)
        """
