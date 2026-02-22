"""
Conector para archivos Excel (.xlsx) como fuente de datos alternativa.

QUE HACE ESTE ARCHIVO:
Lee datos de clientes, productos y ventas desde un archivo Excel.
Es el fallback para distribuidores que no tienen API en su ERP.

CONCEPTO CLAVE - Strategy Pattern:
Tanto ContabiliumConnector como ExcelConnector implementan la misma
interfaz (ERPConnector). El codigo que usa el conector no sabe ni le
importa de donde vienen los datos.

SEGURIDAD:
- read_only=True: abre en modo solo lectura (no modifica el archivo fuente)
- data_only=True: lee valores calculados, NO evalua formulas.
  Esto deshabilita evaluacion de formulas y macros, cerrando un
  vector de ataque completo (archivos Excel maliciosos).
"""

from datetime import date
from pathlib import Path

import openpyxl

from backend.engine.connectors.base import ERPConnector
from backend.engine.core.logger import get_logger

logger = get_logger(__name__)

# Columnas minimas requeridas por hoja
_REQUIRED_COLUMNS = {
    "Clientes": {"Nombre"},  # + al menos Email O Telefono
    "Productos": {"Nombre", "Precio"},
    "Ventas": {"Fecha", "Cliente", "Total"},
}


class ExcelConnector(ERPConnector):
    """Conector de solo lectura para archivos Excel (.xlsx).

    Uso:
        connector = ExcelConnector('/ruta/al/archivo.xlsx')
        connector.test_connection()  # valida estructura
        customers, truncated = connector.fetch_customers()
    """

    def __init__(self, file_path: str) -> None:
        self._file_path = Path(file_path)

    def test_connection(self) -> bool:
        """Validacion completa del archivo Excel.

        1. Verifica que el archivo existe
        2. Verifica que tiene las hojas esperadas: "Clientes", "Productos", "Ventas"
        3. Verifica columnas minimas requeridas por hoja
        """
        # 1. Verificar existencia
        if not self._file_path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {self._file_path}")

        # 2. Verificar hojas
        wb = openpyxl.load_workbook(self._file_path, read_only=True, data_only=True)
        try:
            expected_sheets = {"Clientes", "Productos", "Ventas"}
            actual_sheets = set(wb.sheetnames)
            missing_sheets = expected_sheets - actual_sheets

            if missing_sheets:
                raise ValueError(
                    f"Hojas faltantes: {sorted(missing_sheets)}. "
                    f"Hojas encontradas: {sorted(actual_sheets)}"
                )

            # 3. Verificar columnas minimas por hoja
            for sheet_name, required_cols in _REQUIRED_COLUMNS.items():
                ws = wb[sheet_name]
                # Primera fila = headers
                headers = set()
                for cell in next(ws.iter_rows(min_row=1, max_row=1)):
                    if cell.value is not None:
                        headers.add(str(cell.value).strip())

                missing_cols = required_cols - headers
                if missing_cols:
                    raise ValueError(
                        f"Hoja {sheet_name}: columnas faltantes: {sorted(missing_cols)}. "
                        f"Columnas encontradas: {sorted(headers)}"
                    )

            # Validacion especial para Clientes: necesita Email O Telefono
            ws_clientes = wb["Clientes"]
            headers_clientes = set()
            for cell in next(ws_clientes.iter_rows(min_row=1, max_row=1)):
                if cell.value is not None:
                    headers_clientes.add(str(cell.value).strip())
            if "Email" not in headers_clientes and "Telefono" not in headers_clientes:
                raise ValueError(
                    f"Hoja Clientes: necesita al menos 'Email' o 'Telefono'. "
                    f"Columnas encontradas: {sorted(headers_clientes)}"
                )

        finally:
            wb.close()

        logger.info(f"test_connection(): archivo Excel valido: {self._file_path.name}")
        return True

    def _read_sheet(self, sheet_name: str) -> list[dict]:
        """Lee una hoja completa y retorna lista de dicts (header → valor)."""
        wb = openpyxl.load_workbook(self._file_path, read_only=True, data_only=True)
        try:
            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))

            if not rows:
                return []

            headers = [str(h).strip() if h is not None else f"col_{i}"
                       for i, h in enumerate(rows[0])]

            records = []
            for row in rows[1:]:
                # Saltar filas completamente vacias
                if all(v is None for v in row):
                    continue
                record = dict(zip(headers, row))
                records.append(record)

            return records
        finally:
            wb.close()

    def fetch_customers(self) -> tuple[list[dict], bool]:
        """Lee hoja 'Clientes'. Nunca trunca (archivo completo)."""
        records = self._read_sheet("Clientes")
        logger.info(f"fetch_customers(): {len(records)} clientes leidos de Excel")
        return records, False

    def fetch_products(self) -> tuple[list[dict], bool]:
        """Lee hoja 'Productos'. Nunca trunca (archivo completo)."""
        records = self._read_sheet("Productos")
        logger.info(f"fetch_products(): {len(records)} productos leidos de Excel")
        return records, False

    def fetch_orders(self, since_date: date | None = None) -> tuple[list[dict], bool]:
        """Lee hoja 'Ventas'. Filtra por fecha si since_date se provee."""
        records = self._read_sheet("Ventas")

        if since_date is not None:
            filtered = []
            for r in records:
                fecha = r.get("Fecha")
                if fecha is not None:
                    # openpyxl puede devolver datetime o date directamente
                    if hasattr(fecha, 'date'):
                        fecha = fecha.date()
                    if isinstance(fecha, date) and fecha >= since_date:
                        filtered.append(r)
            records = filtered

        logger.info(f"fetch_orders(): {len(records)} ordenes leidas de Excel")
        return records, False
