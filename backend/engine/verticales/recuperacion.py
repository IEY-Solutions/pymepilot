"""
Vertical V4: Recuperacion de Clientes Inactivos.

QUE HACE ESTE ARCHIVO:
Detecta clientes que ERAN recurrentes (2+ compras) pero dejaron de
comprar hace 60, 90, o 120 dias, y genera mensajes para reactivarlos.
Es como cuando un restaurante le escribe a un cliente habitual que
hace meses no viene: "Te extrañamos, tenes una mesa reservada."

Las ventanas de contacto son:
  - 60 dias: Recordatorio amigable ("hacia rato que no hablabamos")
  - 90 dias: Propuesta concreta ("tenemos novedades")
  - 120 dias: Ultimo intento ("queremos saber si hay algo que mejorar")

EXCLUSION IMPORTANTE: Si el cliente tiene una prediccion activa de
V2 Reposicion (pending/contacted), NO aparece como candidato de V4.
Esto evita que el vendedor le mande dos mensajes distintos al mismo
cliente.

CONCEPTO CLAVE - Confidence Score (4 factores):
  1. Historial previo (30%): compras + monto combinados
  2. Regularidad previa (25%): que tan constante compraba antes
  3. Ventana inactividad (25%): 60d=tibio, 90d=frio, 120d=casi perdido
  4. Antiguedad relacion (20%): relacion larga = mas recuperable
"""

from datetime import date

from backend.engine.core.logger import get_logger
from backend.engine.db.queries import (
    get_product_context,
    get_recovery_candidates,
)
from backend.engine.verticales.base import VerticalBase

logger = get_logger(__name__)


class VerticalRecuperacion(VerticalBase):
    """Vertical V4: Recuperacion de Clientes Inactivos.

    Hereda el flujo completo de VerticalBase e implementa los 5
    metodos abstractos especificos de recuperacion.

    Cada ventana (60/90/120 dias) genera UNA prediccion. Si el
    cliente no responde, recibe el siguiente mensaje en la proxima
    ventana. Maximo 3 intentos.
    """

    # --- Configuracion de la vertical ---
    vertical_name = 'recuperacion'
    prompt_file = 'recuperacion.txt'
    max_tokens_response = 350

    # ================================================================
    # METODOS ABSTRACTOS IMPLEMENTADOS
    # ================================================================

    def get_candidates(self, conn, tenant_id: str) -> list[dict]:
        """Busca clientes inactivos en ventana 60/90/120 dias."""
        return get_recovery_candidates(conn, tenant_id)

    def get_context(self, conn, tenant_id: str, candidate: dict) -> dict:
        """Obtiene historial de productos que el cliente solia comprar."""
        customer_id = str(candidate['customer_id'])
        products = get_product_context(conn, tenant_id, customer_id)
        return {'products': products}

    def calculate_confidence(self, candidate: dict, context: dict) -> float:
        """Calcula confidence score con 4 factores ponderados.

        | Factor              | Peso | Que mide                        |
        |---------------------|------|---------------------------------|
        | Historial previo    | 30%  | Compras + monto combinados      |
        | Regularidad previa  | 25%  | Que tan constante compraba      |
        | Ventana inactividad | 25%  | Tibio (60d) vs frio (120d)      |
        | Antiguedad relacion | 20%  | Relacion larga = recuperable    |

        Returns:
            float entre 0.0 y 1.0
        """
        f_history = self._factor_purchase_history(candidate)
        f_regularity = self._factor_regularity(candidate)
        f_window = self._factor_inactivity_window(candidate)
        f_tenure = self._factor_tenure(candidate)

        score = (
            f_history * 0.30
            + f_regularity * 0.25
            + f_window * 0.25
            + f_tenure * 0.20
        )

        logger.debug(
            f"Confidence {candidate.get('name')}: "
            f"history={f_history:.2f} "
            f"regularity={f_regularity:.2f} "
            f"window={f_window:.2f} "
            f"tenure={f_tenure:.2f} "
            f"-> score={score:.3f}"
        )

        return score

    def build_prompt_data(
        self, candidate: dict, context: dict, profile: str,
    ) -> dict:
        """Construye el dict con TODOS los placeholders del prompt."""
        amount = float(candidate.get('total_purchases_amount', 0))
        today = date.today()

        products_summary = self._format_products_summary(
            context.get('products', []), today,
        )

        return {
            'window_days': candidate.get('window_days', 60),
            'profile': profile,
            'customer_name': candidate.get('name', ''),
            'total_purchases_count': candidate.get('total_purchases_count', 0),
            'total_purchases_amount': f"{amount:,.0f}",
            'days_inactive': candidate.get('days_inactive', 0),
            'last_purchase_date': str(candidate.get('last_purchase_date', '')),
            'products_summary': products_summary,
        }

    def calculate_contact_date(self, candidate: dict) -> date | None:
        """Fecha de contacto: hoy (ya esta en ventana de inactividad)."""
        return date.today()

    # ================================================================
    # OVERRIDES
    # ================================================================

    def classify_profile(self, candidate: dict, vip_threshold: float) -> str:
        """Clasifica perfil del cliente inactivo para ajustar tono.

        Override necesario porque base.py usa days_until_predicted
        (campo de V2 Reposicion) que V4 no tiene. En su lugar,
        usamos window_days para determinar urgencia.

        Perfiles:
        - VIP: facturacion en top 20% (>= vip_threshold)
        - En riesgo: ventana de 120 dias (casi perdido)
        - Nuevo-recurrente: exactamente 2 compras
        - Regular: todos los demas
        """
        amount = float(candidate.get('total_purchases_amount') or 0)
        count = candidate.get('total_purchases_count', 0)
        window = candidate.get('window_days', 60)

        if vip_threshold > 0 and amount >= vip_threshold:
            return 'VIP'

        if window >= 120:
            return 'En riesgo'

        if count == 2:
            return 'Nuevo-recurrente'

        return 'Regular'

    def build_metadata(
        self,
        candidate: dict,
        context: dict,
        profile: str,
        confidence: float,
    ) -> dict:
        """Extiende metadata base con datos de ventana y factores."""
        meta = super().build_metadata(candidate, context, profile, confidence)

        # INVARIANTE: almacenar como int. La query de dedup en queries.py
        # compara con metadata->>'window_days' que retorna text en PostgreSQL.
        # PG convierte int JSON a text automaticamente. No cambiar a str().
        meta['window_days'] = candidate.get('window_days', 60)
        meta['days_inactive'] = candidate.get('days_inactive', 0)
        meta['confidence_factors'] = {
            'purchase_history': round(
                self._factor_purchase_history(candidate), 3,
            ),
            'regularity': round(
                self._factor_regularity(candidate), 3,
            ),
            'inactivity_window': round(
                self._factor_inactivity_window(candidate), 3,
            ),
            'tenure': round(
                self._factor_tenure(candidate), 3,
            ),
        }

        return meta

    # ================================================================
    # METODOS PRIVADOS
    # ================================================================

    def _factor_purchase_history(self, candidate: dict) -> float:
        """Factor 1: Historial previo (30%).

        Combina cantidad de compras y monto total. Un cliente con
        muchas compras y monto alto es mas valioso de recuperar.

        Formula: min((count/10 + amount_ratio) / 2, 1.0)
        Donde amount_ratio = total / $500,000 (cap 1.0).
        """
        count = candidate.get('total_purchases_count', 0)
        amount = float(candidate.get('total_purchases_amount', 0))

        count_score = min(count / 10.0, 1.0)
        amount_score = min(amount / 500_000, 1.0)

        return min((count_score + amount_score) / 2.0, 1.0)

    @staticmethod
    def _factor_regularity(candidate: dict) -> float:
        """Factor 2: Regularidad previa (25%).

        Reutiliza la logica de reposicion: CV = stddev / avg.
        Si compraba regularmente antes de irse, es mas probable
        que vuelva con el estimulo correcto.

        Si no hay stddev (< 3 ordenes) → 0.5 (neutro).
        """
        avg = float(candidate.get('avg_days_between_purchases') or 0)
        stddev = candidate.get('stddev_days_between_purchases')

        if stddev is None or avg <= 0:
            return 0.5

        cv = float(stddev) / avg
        return max(0.0, 1.0 - cv)

    @staticmethod
    def _factor_inactivity_window(candidate: dict) -> float:
        """Factor 3: Ventana de inactividad (25%).

        Cuanto menos tiempo paso, mas probable es la recuperacion.

        60 dias = 0.8 (todavia tibio)
        90 dias = 0.5 (frio)
        120 dias = 0.2 (casi perdido)
        """
        window = candidate.get('window_days', 60)

        if window == 60:
            return 0.8
        elif window == 90:
            return 0.5
        else:
            return 0.2

    @staticmethod
    def _factor_tenure(candidate: dict) -> float:
        """Factor 4: Antiguedad de la relacion (20%).

        Reutiliza la logica de reposicion: meses / 12, cap en 1.0.
        Relacion mas larga = mas probabilidad de que vuelva.
        """
        first_purchase = candidate.get('first_purchase_date')
        if first_purchase is None:
            return 0.0

        months = (date.today() - first_purchase).days / 30.0
        return min(months / 12.0, 1.0)

    @staticmethod
    def _format_products_summary(
        products: list[dict], today: date,
    ) -> str:
        """Formatea la lista de productos para el prompt.

        Ejemplo:
          - Funda MagSafe iPhone 15: ~36 unidades, ultima hace 65 dias
          - PopGrip MagSafe: ~17 unidades, ultima hace 65 dias
        """
        if not products:
            return '(sin historial de productos)'

        lines = []
        for p in products[:6]:
            name = p.get('product_name', '?')
            avg_qty = int(p.get('avg_quantity') or 0)
            last_ordered = p.get('last_ordered')

            days_ago = ''
            if last_ordered:
                days = (today - last_ordered).days
                days_ago = f", ultima hace {days} dias"

            lines.append(f"- {name}: ~{avg_qty} unidades{days_ago}")

        return '\n'.join(lines)
