"""
Vertical V2: Reposicion Predictiva.

QUE HACE ESTE ARCHIVO:
Predice CUANDO un cliente necesita reponer mercaderia y genera un
mensaje personalizado para contactarlo en el momento justo.

En vez de esperar a que el cliente llame (o peor, que se vaya a la
competencia), PymePilot detecta el patron de compra y avisa al
vendedor ANTES de que el cliente se quede sin stock.

EJEMPLO: "GadgetBox Tucuman compra cada ~10 dias. Su ultima compra
fue hace 8 dias. En 2 dias va a necesitar reponer. Confianza: 0.78.
Mensaje sugerido: Hola GadgetBox, te reservo las Fundas MagSafe?"

CONCEPTO CLAVE - Confidence Score (5 factores):
No todos los clientes son igual de predecibles. El score combina:
  1. Regularidad (35%): que tan constante es el ritmo de compra
  2. Cantidad de datos (20%): mas compras = mas certeza
  3. Recencia (15%): compro hace poco? esta en ritmo?
  4. Tendencia (15%): esta comprando mas o menos que antes?
  5. Antiguedad (15%): relacion larga = mas confiable

El score va de 0.0 (no confio nada) a 1.0 (certeza maxima).
"""

from datetime import date

from backend.engine.core.logger import get_logger
from backend.engine.db.queries import (
    get_product_context,
    get_reorder_candidates,
)
from backend.engine.verticales.base import VerticalBase

logger = get_logger(__name__)


class VerticalReposicion(VerticalBase):
    """Vertical V2: Reposicion Predictiva.

    Hereda el flujo completo de VerticalBase (cargar prompt, loop de
    candidatos, llamar a Claude, guardar prediccion) e implementa
    los 5 metodos abstractos especificos de reposicion.

    Atributos configurables:
        days_ahead: Cuantos dias hacia adelante buscar candidatos.
        days_overdue: Cuantos dias de atraso incluir como candidatos.
        (Se pueden modificar desde el CLI antes de llamar a run())
    """

    # --- Configuracion de la vertical ---
    vertical_name = 'reposicion'
    prompt_file = 'reposicion.txt'
    max_tokens_response = 400  # Mas espacio para mencionar 3-6 productos

    # --- Ventana de busqueda de candidatos ---
    # Modificables desde el CLI: vertical.days_ahead = 30
    days_ahead: int = 14
    days_overdue: int = 14

    # ================================================================
    # METODOS ABSTRACTOS IMPLEMENTADOS
    # ================================================================

    def get_candidates(self, conn, tenant_id: str) -> list[dict]:
        """Busca clientes proximos a necesitar reposicion.

        Usa la query de queries.py que calcula predicted_date
        (ultima compra + avg_days) y filtra los que estan dentro
        de la ventana de contacto.
        """
        return get_reorder_candidates(
            conn, tenant_id,
            days_ahead=self.days_ahead,
            days_overdue=self.days_overdue,
        )

    def get_context(self, conn, tenant_id: str, candidate: dict) -> dict:
        """Obtiene historial de productos del candidato.

        Retorna dict con key 'products': lista de productos que
        el cliente compra, con cantidades, frecuencia, y prediccion
        de recompra por producto.
        """
        customer_id = str(candidate['customer_id'])
        products = get_product_context(conn, tenant_id, customer_id)
        return {'products': products}

    def calculate_confidence(self, candidate: dict, context: dict) -> float:
        """Calcula confidence score con 5 factores ponderados.

        | Factor          | Peso | Que mide                           |
        |-----------------|------|------------------------------------|
        | Regularidad     | 35%  | Que tan constante compra           |
        | Datos           | 20%  | Cuantas compras tiene              |
        | Recencia        | 15%  | Esta en ritmo o atrasado?          |
        | Tendencia       | 15%  | Compra mas o menos que antes?      |
        | Antiguedad      | 15%  | Hace cuanto es cliente?            |

        Returns:
            float entre 0.0 y 1.0
        """
        factors = self._calculate_factors(candidate, context)

        score = (
            factors['regularity'] * 0.35
            + factors['data_quantity'] * 0.20
            + factors['recency'] * 0.15
            + factors['trend'] * 0.15
            + factors['tenure'] * 0.15
        )

        logger.debug(
            f"Confidence {candidate.get('name')}: "
            f"reg={factors['regularity']:.2f} "
            f"data={factors['data_quantity']:.2f} "
            f"rec={factors['recency']:.2f} "
            f"trend={factors['trend']:.2f} "
            f"tenure={factors['tenure']:.2f} "
            f"→ score={score:.3f}"
        )

        return score

    def build_prompt_data(
        self, candidate: dict, context: dict, profile: str,
    ) -> dict:
        """Construye el dict con TODOS los placeholders del prompt.

        Cada key corresponde a un {placeholder} en reposicion.txt.
        """
        today = date.today()
        last_purchase = candidate.get('last_purchase_date')
        predicted = candidate.get('predicted_date')

        # Dias desde ultima compra
        days_since = (today - last_purchase).days if last_purchase else 0

        # Descripcion legible de days_until
        days_until = candidate.get('days_until_predicted', 0)
        if days_until > 0:
            days_description = f"en {days_until} dias"
        elif days_until == 0:
            days_description = "hoy"
        else:
            days_description = f"{abs(days_until)} dias de atraso"

        # Formatear resumen de productos
        products_summary = self._format_products_summary(
            context.get('products', []), today,
        )

        # Formatear monto con separador de miles
        amount = candidate.get('total_purchases_amount', 0)
        amount_str = f"{float(amount):,.0f}"

        return {
            'profile': profile,
            'customer_name': candidate.get('name', ''),
            'total_purchases_count': candidate.get('total_purchases_count', 0),
            'total_purchases_amount': amount_str,
            'days_since_last_purchase': days_since,
            'last_purchase_date': str(last_purchase or ''),
            'predicted_date': str(predicted or ''),
            'days_description': days_description,
            'products_summary': products_summary,
        }

    def calculate_contact_date(self, candidate: dict) -> date | None:
        """Fecha sugerida de contacto: la predicted_date o hoy si ya paso.

        Si el cliente ya esta atrasado (predicted_date en el pasado),
        la fecha de contacto es HOY (urgente). Si esta en el futuro,
        usamos la predicted_date.
        """
        predicted = candidate.get('predicted_date')
        if predicted and predicted > date.today():
            return predicted
        return date.today()

    # ================================================================
    # OVERRIDE de metodo con default (agrega factores a metadata)
    # ================================================================

    def build_metadata(
        self,
        candidate: dict,
        context: dict,
        profile: str,
        confidence: float,
    ) -> dict:
        """Extiende metadata base con factores de confianza detallados."""
        # Metadata base (incluye profile, sequence_step, etc.)
        meta = super().build_metadata(candidate, context, profile, confidence)

        # Agregar factores desglosados (util para debugging y analisis)
        factors = self._calculate_factors(candidate, context)
        meta['confidence_factors'] = {
            'regularity': round(factors['regularity'], 3),
            'data_quantity': round(factors['data_quantity'], 3),
            'recency': round(factors['recency'], 3),
            'trend': round(factors['trend'], 3),
            'tenure': round(factors['tenure'], 3),
        }

        # Datos de la prediccion
        meta['predicted_date'] = str(candidate.get('predicted_date', ''))
        meta['days_until_predicted'] = candidate.get('days_until_predicted', 0)
        meta['avg_days'] = float(candidate.get('avg_days_between_purchases') or 0)

        return meta

    # ================================================================
    # METODOS PRIVADOS
    # ================================================================

    def _calculate_factors(self, candidate: dict, context: dict) -> dict:
        """Calcula los 5 factores individuales del confidence score.

        Cada factor retorna un valor entre 0.0 y 1.0.
        """
        return {
            'regularity': self._factor_regularity(candidate),
            'data_quantity': self._factor_data_quantity(candidate),
            'recency': self._factor_recency(candidate),
            'trend': self._factor_trend(context),
            'tenure': self._factor_tenure(candidate),
        }

    def _factor_regularity(self, candidate: dict) -> float:
        """Factor 1: Regularidad (35%).

        Usa el Coeficiente de Variacion (CV = stddev / avg).
        CV bajo = compra regular = score alto.
        CV alto = compra errática = score bajo.

        Ejemplos:
          CV = 0.0 → score = 1.0 (compra como un reloj)
          CV = 0.5 → score = 0.5 (semi-regular)
          CV = 1.0 → score = 0.0 (totalmente impredecible)

        Si no hay stddev (< 3 ordenes) → score = 0.5 (neutro).
        """
        avg = float(candidate.get('avg_days_between_purchases') or 0)
        stddev = candidate.get('stddev_days_between_purchases')

        if stddev is None or avg <= 0:
            return 0.5  # Datos insuficientes → neutro

        cv = float(stddev) / avg
        return max(0.0, 1.0 - cv)

    def _factor_data_quantity(self, candidate: dict) -> float:
        """Factor 2: Cantidad de datos (20%).

        Mas compras = mas certeza en la prediccion.
        Escala lineal: 2 ordenes = 0.2, 10+ ordenes = 1.0.

        POR QUE: Con 2 compras apenas tenemos un intervalo.
        Con 10+ compras tenemos un patron robusto.
        """
        count = candidate.get('total_purchases_count', 0)
        return min(count / 10.0, 1.0)

    def _factor_recency(self, candidate: dict) -> float:
        """Factor 3: Recencia (15%).

        Mide si el cliente esta "en ritmo" de compra.
        Ratio = dias_desde_ultima / avg_days.
          ratio ≈ 1.0 → justo a tiempo (score alto)
          ratio < 1.0 → compro hace poco (score alto)
          ratio >> 1.0 → muy atrasado (score baja)

        Formula: score = max(0, 1.0 - |ratio - 1.0| * 0.7)
        """
        avg = float(candidate.get('avg_days_between_purchases') or 0)
        last_purchase = candidate.get('last_purchase_date')

        if avg <= 0 or last_purchase is None:
            return 0.5

        days_since = (date.today() - last_purchase).days
        ratio = days_since / avg

        return max(0.0, 1.0 - abs(ratio - 1.0) * 0.7)

    def _factor_trend(self, context: dict) -> float:
        """Factor 4: Tendencia de cantidad (15%).

        Mide si el patron de compra esta establecido.
        Usa la frecuencia de recompra de los productos:
          - Producto top comprado 3+ veces → patron fuerte (0.8)
          - Producto top comprado 2 veces → patron incipiente (0.5)
          - Ningun producto repetido → señal debil (0.3)

        NOTA: En una futura iteracion se puede refinar comparando
        la ultima cantidad vs promedio anterior por producto.
        """
        products = context.get('products', [])
        if not products:
            return 0.3

        # El primer producto es el mas frecuente (ORDER BY count DESC)
        top_product_orders = products[0].get('times_ordered', 0)

        if top_product_orders >= 3:
            return 0.8
        elif top_product_orders >= 2:
            return 0.5
        else:
            return 0.3

    def _factor_tenure(self, candidate: dict) -> float:
        """Factor 5: Antiguedad de la relacion (15%).

        Relacion mas larga = patron mas confiable.
        Escala: 1 mes = ~0.08, 6 meses = 0.5, 12+ meses = 1.0.
        """
        first_purchase = candidate.get('first_purchase_date')
        if first_purchase is None:
            return 0.0

        months = (date.today() - first_purchase).days / 30.0
        return min(months / 12.0, 1.0)

    def _format_products_summary(
        self, products: list[dict], today: date,
    ) -> str:
        """Formatea la lista de productos para el prompt.

        Ejemplo de output:
          - Funda MagSafe iPhone 15: ~36 unidades, ultima hace 56 dias
          - PopGrip MagSafe: ~17 unidades, ultima hace 56 dias
        """
        if not products:
            return '(sin historial de productos)'

        lines = []
        for p in products[:6]:  # Maximo 6 productos en el prompt
            name = p.get('product_name', '?')
            avg_qty = int(p.get('avg_quantity') or 0)
            last_ordered = p.get('last_ordered')

            days_ago = ''
            if last_ordered:
                days = (today - last_ordered).days
                days_ago = f", ultima hace {days} dias"

            reorder_info = ''
            predicted = p.get('predicted_reorder_date')
            if predicted:
                days_until = (predicted - today).days
                if days_until > 0:
                    reorder_info = f", reposicion estimada en {days_until} dias"
                elif days_until == 0:
                    reorder_info = ", reposicion estimada HOY"
                else:
                    reorder_info = f", reposicion {abs(days_until)} dias atrasada"

            lines.append(f"- {name}: ~{avg_qty} unidades{days_ago}{reorder_info}")

        return '\n'.join(lines)
