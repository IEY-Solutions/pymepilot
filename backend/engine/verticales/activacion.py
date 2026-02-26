"""
Vertical V1: Activacion de Clientes Nuevos.

QUE HACE ESTE ARCHIVO:
Detecta clientes que hicieron UNA sola compra y genera mensajes de
seguimiento para convertirlos en recurrentes. Es como cuando compras
en una tienda nueva y te mandan un "como te fue?" a los pocos dias.

La secuencia tiene 3 puntos de contacto:
  - Dia 7: Follow-up calido ("como te fue con el pedido?")
  - Dia 15: Sugerencia complementaria
  - Dia 25: Propuesta de recompra

Si el cliente compra de nuevo antes de completar la secuencia,
"se gradua" automaticamente y sale del radar de V1 (porque ya
tiene 2+ compras y pasa a V2 Reposicion).

CONCEPTO CLAVE - Confidence Score (3 factores):
  1. Monto primera compra (40%): ticket alto = mas comprometido
  2. Variedad de productos (35%): mas productos = exploro mas
  3. Dia de secuencia (25%): dia 7 = fresco, dia 25 = frio
"""

from datetime import date

from backend.engine.core.logger import get_logger
from backend.engine.db.queries import (
    get_activation_candidates,
    get_product_context,
)
from backend.engine.verticales.base import VerticalBase

logger = get_logger(__name__)


class VerticalActivacion(VerticalBase):
    """Vertical V1: Activacion de Clientes Nuevos.

    Hereda el flujo completo de VerticalBase e implementa los 5
    metodos abstractos especificos de activacion.

    La secuencia 7/15/25 se evalua cada dia — el motor revisa
    quien cae en ventana y genera el mensaje correspondiente.
    """

    # --- Configuracion de la vertical ---
    vertical_name = 'activacion'
    prompt_file = 'activacion.txt'
    max_tokens_response = 300

    # ================================================================
    # METODOS ABSTRACTOS IMPLEMENTADOS
    # ================================================================

    def get_candidates(self, conn, tenant_id: str) -> list[dict]:
        """Busca clientes nuevos en ventana de secuencia 7/15/25 dias."""
        return get_activation_candidates(conn, tenant_id)

    def get_context(self, conn, tenant_id: str, candidate: dict) -> dict:
        """Obtiene productos de la primera (y unica) compra del cliente."""
        customer_id = str(candidate['customer_id'])
        products = get_product_context(conn, tenant_id, customer_id)
        return {'products': products}

    def calculate_confidence(self, candidate: dict, context: dict) -> float:
        """Calcula confidence score con 3 factores ponderados.

        | Factor              | Peso | Que mide                        |
        |---------------------|------|---------------------------------|
        | Monto 1ra compra    | 40%  | Ticket alto = mas comprometido  |
        | Variedad productos  | 35%  | Mas productos = mas exploracion |
        | Dia de secuencia    | 25%  | Fresco (7d) vs frio (25d)       |

        Returns:
            float entre 0.0 y 1.0
        """
        f_amount = self._factor_first_order_amount(candidate)
        f_variety = self._factor_product_variety(context)
        f_sequence = self._factor_sequence_day(candidate)

        score = (
            f_amount * 0.40
            + f_variety * 0.35
            + f_sequence * 0.25
        )

        logger.debug(
            f"Confidence {candidate.get('name')}: "
            f"amount={f_amount:.2f} "
            f"variety={f_variety:.2f} "
            f"sequence={f_sequence:.2f} "
            f"-> score={score:.3f}"
        )

        return score

    def build_prompt_data(
        self, candidate: dict, context: dict, profile: str,
    ) -> dict:
        """Construye el dict con TODOS los placeholders del prompt."""
        amount = float(candidate.get('total_purchases_amount', 0))

        products_summary = self._format_products_summary(
            context.get('products', []),
        )

        return {
            'sequence_day': candidate.get('sequence_day', 7),
            'customer_name': candidate.get('name', ''),
            'days_since_first': candidate.get('days_since_first', 0),
            'first_purchase_date': str(candidate.get('first_purchase_date', '')),
            'first_order_amount': f"{amount:,.0f}",
            'products_summary': products_summary,
        }

    def calculate_contact_date(self, candidate: dict) -> date | None:
        """Fecha de contacto: hoy (ya esta en ventana de secuencia)."""
        return date.today()

    # ================================================================
    # OVERRIDES
    # ================================================================

    def classify_profile(self, candidate: dict, vip_threshold: float) -> str:
        """Todos los candidatos de V1 son 'Nuevo' por definicion."""
        return 'Nuevo'

    def build_metadata(
        self,
        candidate: dict,
        context: dict,
        profile: str,
        confidence: float,
    ) -> dict:
        """Extiende metadata base con datos de secuencia y factores."""
        meta = super().build_metadata(candidate, context, profile, confidence)

        meta['sequence_day'] = candidate.get('sequence_day', 7)
        meta['days_since_first'] = candidate.get('days_since_first', 0)
        meta['confidence_factors'] = {
            'first_order_amount': round(
                self._factor_first_order_amount(candidate), 3,
            ),
            'product_variety': round(
                self._factor_product_variety(context), 3,
            ),
            'sequence_day': round(
                self._factor_sequence_day(candidate), 3,
            ),
        }

        return meta

    # ================================================================
    # METODOS PRIVADOS
    # ================================================================

    def _factor_first_order_amount(self, candidate: dict) -> float:
        """Factor 1: Monto primera compra (40%).

        Normaliza contra un tope fijo de $500,000 (consistente con
        calculate_priority de base.py). Ticket alto = cliente
        mas comprometido = mas probable que vuelva.

        Escala: $0 = 0.0, $250k = 0.5, $500k+ = 1.0.
        """
        amount = float(candidate.get('total_purchases_amount', 0))
        return min(amount / 500_000, 1.0)

    @staticmethod
    def _factor_product_variety(context: dict) -> float:
        """Factor 2: Variedad de productos (35%).

        Mas productos en la primera compra = el cliente exploro
        el catalogo = mas probabilidad de volver.

        Escala: 1 producto = 0.3, 2 = 0.5, 3 = 0.7, 4+ = 0.9.
        """
        products = context.get('products', [])
        count = len(products)

        if count >= 4:
            return 0.9
        elif count == 3:
            return 0.7
        elif count == 2:
            return 0.5
        else:
            return 0.3

    @staticmethod
    def _factor_sequence_day(candidate: dict) -> float:
        """Factor 3: Dia de secuencia (25%).

        Cuanto mas temprano en la secuencia, mas fresco esta el
        recuerdo de la compra y mas efectivo el mensaje.

        Dia 7 = 0.8, Dia 15 = 0.5, Dia 25 = 0.3.
        """
        day = candidate.get('sequence_day', 7)

        if day == 7:
            return 0.8
        elif day == 15:
            return 0.5
        else:
            return 0.3

    @staticmethod
    def _format_products_summary(products: list[dict]) -> str:
        """Formatea la lista de productos para el prompt.

        Ejemplo:
          - Funda MagSafe iPhone 15: 5 unidades
          - PopGrip MagSafe: 3 unidades
        """
        if not products:
            return '(sin historial de productos)'

        lines = []
        for p in products[:6]:
            name = p.get('product_name', '?')
            total_qty = int(p.get('total_quantity') or 0)
            lines.append(f"- {name}: {total_qty} unidades")

        return '\n'.join(lines)
