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

    @abstractmethod
    def fetch_customers(self) -> tuple[list[dict], bool]:
        """Obtiene todos los clientes del ERP.

        Retorna:
            tuple[list[dict], bool]: (clientes, truncated)
        """

    @abstractmethod
    def fetch_products(self) -> tuple[list[dict], bool]:
        """Obtiene todos los productos del ERP.

        Retorna:
            tuple[list[dict], bool]: (productos, truncated)
        """

    @abstractmethod
    def fetch_orders(self, since_date: date | None = None) -> tuple[list[dict], bool]:
        """Obtiene ordenes/comprobantes del ERP.

        Args:
            since_date: Si se provee, solo trae ordenes desde esa fecha.
                       Si es None, trae todas (sync full).

        Retorna:
            tuple[list[dict], bool]: (ordenes, truncated)
        """
