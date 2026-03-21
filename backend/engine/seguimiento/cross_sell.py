"""
Vertical V3: Cross-Sell.

QUE HACE ESTE ARCHIVO:
Detecta clientes activos que NUNCA compraron ciertos productos pero
que otros clientes con compras similares SI compran, y genera mensajes
sugiriendo esos productos. Es como cuando Amazon te dice "los clientes
que compraron esto tambien compraron esto otro".

La logica se basa en co-compras: si el 75% de los clientes que compran
Fundas MagSafe tambien compran Vidrios Templados, y Juan compra fundas
pero NO vidrios, la oportunidad es clara.

FRECUENCIA: V3 se ejecuta 1 vez por semana (lunes), no diario como
V1/V2/V4. Sugerir productos nuevos tiene sentido con menos frecuencia
que recordar reposicion.

CONCEPTO CLAVE - Co-compras (Market Basket Analysis):
Es una tecnica de analisis de canasta de compras. Mira millones de
tickets (o en nuestro caso, cientos) y encuentra patrones: "producto
A y producto B se compran juntos en el 75% de los casos". PymePilot
usa estos patrones para recomendar productos que el cliente todavia
no descubrio.

CONCEPTO CLAVE - Confidence Score (4 factores):
  1. Fuerza co-compra (35%): que tan fuerte es la asociacion entre
     lo que compra y lo que le sugerimos (75% > 30%)
  2. Historial cliente (25%): mas compras = mas confianza en el patron
  3. Popularidad producto (20%): producto mas vendido = menos riesgo
  4. Recencia (20%): compro hace poco = mas receptivo
"""

from datetime import date

from backend.engine.core.logger import get_logger
from backend.engine.db.queries import (
    get_cross_sell_candidates,
    get_cross_sell_products,
    get_product_context,
)
from backend.engine.seguimiento.base import VerticalBase

logger = get_logger(__name__)


class VerticalCrossSell(VerticalBase):
    """Vertical V3: Cross-Sell.

    Hereda el flujo completo de VerticalBase e implementa los 5
    metodos abstractos especificos de cross-sell.

    Se ejecuta 1 vez por semana (lunes). El orquestador verifica
    el dia de la semana antes de ejecutar esta vertical.
    """

    # --- Configuracion de la vertical ---
    vertical_name = 'cross_sell'
    prompt_file = 'cross_sell.txt'
    max_tokens_response = 400  # Necesita espacio para mencionar 1-3 productos nuevos

    # ================================================================
    # METODOS ABSTRACTOS IMPLEMENTADOS
    # ================================================================

    def get_candidates(self, conn, tenant_id: str) -> list[dict]:
        """Busca clientes activos con oportunidades de cross-sell.

        Usa la vista materializada co_purchases (pre-calculada a diario)
        para encontrar clientes que tienen productos "faltantes" —
        productos que otros clientes similares compran pero este no.
        """
        return get_cross_sell_candidates(conn, tenant_id)

    def get_context(self, conn, tenant_id: str, candidate: dict) -> dict:
        """Obtiene productos actuales del cliente + productos recomendados.

        Retorna dict con dos keys:
        - 'products': lo que el cliente ya compra (para el prompt)
        - 'recommended': lo que le sugerimos (top 3 por co-compra)
        """
        customer_id = str(candidate['customer_id'])

        # Productos que ya compra (historial)
        products = get_product_context(conn, tenant_id, customer_id)

        # Productos recomendados por co-compra (top 3)
        recommended = get_cross_sell_products(
            conn, tenant_id, customer_id, limit=3,
        )

        return {
            'products': products,
            'recommended': recommended,
        }

    def calculate_confidence(self, candidate: dict, context: dict) -> float:
        """Calcula confidence score con 4 factores ponderados.

        | Factor              | Peso | Que mide                        |
        |---------------------|------|---------------------------------|
        | Fuerza co-compra    | 35%  | Rate maximo de co-compra        |
        | Historial cliente   | 25%  | Cantidad de compras             |
        | Popularidad prod.   | 20%  | Veces comprado el prod sugerido |
        | Recencia            | 20%  | Dias desde ultima compra        |

        Returns:
            float entre 0.0 y 1.0
        """
        factors = self._calculate_factors(candidate, context)
        # Cachear para reusar en build_metadata sin recalcular
        candidate['_cached_factors'] = factors

        score = (
            factors['co_purchase_strength'] * 0.35
            + factors['customer_history'] * 0.25
            + factors['product_popularity'] * 0.20
            + factors['recency'] * 0.20
        )

        logger.debug(
            f"Confidence {candidate.get('name')}: "
            f"co_strength={factors['co_purchase_strength']:.2f} "
            f"history={factors['customer_history']:.2f} "
            f"popularity={factors['product_popularity']:.2f} "
            f"recency={factors['recency']:.2f} "
            f"-> score={score:.3f}"
        )

        return score

    def build_prompt_data(
        self, candidate: dict, context: dict, profile: str,
    ) -> dict:
        """Construye el dict con TODOS los placeholders del prompt.

        Cada key corresponde a un {placeholder} en cross_sell.txt.
        """
        amount = float(candidate.get('total_purchases_amount', 0))

        # Productos que ya compra (para anclar el mensaje)
        current_products = self._format_current_products(
            context.get('products', []),
        )

        # Productos sugeridos (las recomendaciones de cross-sell)
        suggested_products = self._format_suggested_products(
            context.get('recommended', []),
        )

        return {
            'profile': profile,
            'customer_name': candidate.get('name', ''),
            'total_purchases_count': candidate.get('total_purchases_count', 0),
            'total_purchases_amount': f"{amount:,.0f}",
            'days_since_last_purchase': candidate.get(
                'days_since_last_purchase', 0,
            ),
            'current_products': current_products,
            'suggested_products': suggested_products,
        }

    def calculate_contact_date(self, candidate: dict) -> date | None:
        """Fecha de contacto: hoy (ya es lunes y esta en el pool)."""
        return date.today()

    # ================================================================
    # OVERRIDES
    # ================================================================

    def classify_profile(self, candidate: dict, vip_threshold: float) -> str:
        """Clasifica perfil del cliente para ajustar tono del mensaje.

        Override necesario porque base.py usa days_until_predicted
        (campo de V2 Reposicion) que V3 no tiene. Usamos una
        clasificacion mas simple basada en facturacion y compras.

        Perfiles:
        - VIP: facturacion en top 20% (>= vip_threshold)
        - Nuevo-recurrente: exactamente 2 compras (recien repetidor)
        - Regular: todos los demas
        """
        amount = float(candidate.get('total_purchases_amount', 0))
        count = candidate.get('total_purchases_count', 0)

        if vip_threshold > 0 and amount >= vip_threshold:
            return 'VIP'

        if count == 2:
            return 'Nuevo-recurrente'

        return 'Regular'

    def build_suggested_products(self, context: dict) -> list[dict]:
        """Formatea productos recomendados para el campo suggested_products.

        Override de base.py: en vez de usar los productos que el
        cliente YA compra (que es el default), guardamos los productos
        que le SUGERIMOS comprar.
        """
        recommended = context.get('recommended', [])
        return [
            {
                'product_id': str(p.get('product_id', '')),
                'product_name': p.get('product_name', ''),
                'co_purchase_rate': round(
                    float(p.get('co_purchase_rate', 0)), 2,
                ),
                'because_buys': p.get('because_buys', ''),
            }
            for p in recommended[:3]
        ]

    def build_metadata(
        self,
        candidate: dict,
        context: dict,
        profile: str,
        confidence: float,
    ) -> dict:
        """Extiende metadata base con datos de cross-sell y factores."""
        meta = super().build_metadata(candidate, context, profile, confidence)
        meta['vertical_context'] = 'cross_sell'

        # Productos sugeridos con detalle
        recommended = context.get('recommended', [])
        meta['suggested_products'] = [
            {
                'product_id': str(p.get('product_id', '')),
                'name': p.get('product_name', ''),
                'co_rate': round(float(p.get('co_purchase_rate', 0)), 2),
            }
            for p in recommended[:3]
        ]

        # Reusar factores cacheados (calculados en calculate_confidence)
        factors = candidate.pop('_cached_factors', None) or self._calculate_factors(candidate, context)
        meta['confidence_factors'] = {
            'co_purchase_strength': round(
                factors['co_purchase_strength'], 3,
            ),
            'customer_history': round(factors['customer_history'], 3),
            'product_popularity': round(factors['product_popularity'], 3),
            'recency': round(factors['recency'], 3),
        }

        # Stats del candidato
        meta['missing_products_count'] = candidate.get(
            'missing_products_count', 0,
        )
        meta['days_since_last_purchase'] = candidate.get(
            'days_since_last_purchase', 0,
        )

        return meta

    # ================================================================
    # METODOS PRIVADOS
    # ================================================================

    def _calculate_factors(self, candidate: dict, context: dict) -> dict:
        """Calcula los 4 factores individuales del confidence score.

        Cada factor retorna un valor entre 0.0 y 1.0.
        """
        return {
            'co_purchase_strength': self._factor_co_purchase_strength(
                candidate,
            ),
            'customer_history': self._factor_customer_history(candidate),
            'product_popularity': self._factor_product_popularity(context),
            'recency': self._factor_recency(candidate),
        }

    @staticmethod
    def _factor_co_purchase_strength(candidate: dict) -> float:
        """Factor 1: Fuerza de co-compra (35%).

        Usa el max_co_purchase_rate del candidato (calculado en la
        query de candidatos). Cuanto mas alto el rate, mas fuerte
        es la asociacion entre los productos.

        Rate = 0.30 -> score = 0.0 (umbral minimo)
        Rate = 0.50 -> score = 0.29
        Rate = 0.75 -> score = 0.64
        Rate = 1.00 -> score = 1.0 (asociacion perfecta)

        Formula: (rate - 0.30) / 0.70, normalizado al rango 0-1.
        """
        rate = float(candidate.get('max_co_purchase_rate', 0))
        # Normalizar: 0.30 -> 0.0, 1.0 -> 1.0
        return max(0.0, min((rate - 0.30) / 0.70, 1.0))

    @staticmethod
    def _factor_customer_history(candidate: dict) -> float:
        """Factor 2: Historial del cliente (25%).

        Mas compras = mas datos para confiar en el patron de co-compra.
        Un cliente con 10+ pedidos tiene un historial robusto.

        Escala lineal: 2 ordenes = 0.2, 5 = 0.5, 10+ = 1.0.
        """
        count = candidate.get('total_purchases_count', 0)
        return min(count / 10.0, 1.0)

    @staticmethod
    def _factor_product_popularity(context: dict) -> float:
        """Factor 3: Popularidad del producto sugerido (20%).

        Productos mas vendidos (times_bought_together alto) son
        recomendaciones menos riesgosas — mucha gente los compra.

        Escala: 3 veces juntos = 0.2 (minimo), 10 = 0.5, 20+ = 1.0.
        """
        recommended = context.get('recommended', [])
        if not recommended:
            return 0.3  # Neutro si no hay recomendaciones

        # Usar el producto con mayor co-ocurrencia
        max_times = max(
            int(p.get('times_bought_together', 0))
            for p in recommended
        )
        return min(max_times / 20.0, 1.0)

    @staticmethod
    def _factor_recency(candidate: dict) -> float:
        """Factor 4: Recencia de ultima compra (20%).

        Cuanto mas reciente la ultima compra, mas receptivo esta
        el cliente a sugerencias de nuevos productos.

        0-7 dias = 1.0 (muy fresco)
        7-14 dias = 0.8
        14-30 dias = 0.6
        30-45 dias = 0.4
        45-60 dias = 0.2
        """
        days = candidate.get('days_since_last_purchase', 30)

        if days <= 7:
            return 1.0
        elif days <= 14:
            return 0.8
        elif days <= 30:
            return 0.6
        elif days <= 45:
            return 0.4
        else:
            return 0.2

    @staticmethod
    def _format_current_products(products: list[dict]) -> str:
        """Formatea los productos que el cliente ya compra para el prompt.

        Ejemplo:
          - Funda MagSafe iPhone 15: ~36 unidades (compra frecuente)
          - PopGrip MagSafe: ~17 unidades
        """
        if not products:
            return '(sin historial de productos)'

        lines = []
        for p in products[:6]:
            name = p.get('product_name', '?')
            avg_qty = int(p.get('avg_quantity') or 0)
            times = p.get('times_ordered', 0)

            freq = ''
            if times >= 5:
                freq = ' (compra frecuente)'
            elif times >= 3:
                freq = ' (compra regular)'

            lines.append(f"- {name}: ~{avg_qty} unidades{freq}")

        return '\n'.join(lines)

    @staticmethod
    def _format_suggested_products(recommended: list[dict]) -> str:
        """Formatea los productos sugeridos para el prompt.

        Ejemplo:
          - Vidrio Templado (75% de los que compran Funda MagSafe
            tambien lo compran, comprado junto 12 veces)
          - Cable USB-C (45% co-compra con Cargador Inalambrico)
        """
        if not recommended:
            return '(sin productos sugeridos)'

        lines = []
        for p in recommended[:3]:
            name = p.get('product_name', '?')
            rate = float(p.get('co_purchase_rate', 0))
            because = p.get('because_buys', '?')
            times = p.get('times_bought_together', 0)

            lines.append(
                f"- {name} ({rate:.0%} de los que compran {because} "
                f"tambien lo compran, {times} veces juntos)"
            )

        return '\n'.join(lines)
