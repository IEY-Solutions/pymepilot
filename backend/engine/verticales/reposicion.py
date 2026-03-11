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

import json
import time
from datetime import date

from backend.engine.core.logger import get_logger, sanitize_text
from backend.engine.db.connection import get_db_connection, get_tenant_id_by_slug
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

    def __init__(self) -> None:
        super().__init__()
        # Conector de stock (se configura en run() si el tenant lo soporta)
        self._stock_connector = None
        self._stock_warehouse: str | None = None
        self._stock_creds_cm = None  # Context manager de TenantCredentials

    # ================================================================
    # OVERRIDE DE run() — Setup/teardown del conector de stock
    # ================================================================

    def run(
        self,
        tenant_slug: str,
        dry_run: bool = False,
        limit: int | None = None,
        min_confidence: float = 0.0,
    ) -> dict:
        """Extiende run() para configurar el conector de stock antes de procesar.

        QUE HACE: Antes de ejecutar el flujo normal de la vertical, verifica
        si el tenant tiene configurado un deposito de stock (erp_config.stock_warehouse).
        Si lo tiene y es de tipo contabilium, crea un conector autenticado que
        se reutiliza para todos los candidatos (1 sola autenticacion por corrida).

        POR QUE OVERRIDE run() Y NO get_context():
        Crear un conector por cada candidato (en get_context) significaria
        N autenticaciones (POST /token) por corrida. Con el override de run(),
        autenticamos UNA vez y reutilizamos para todos los candidatos.

        SEGURIDAD: El conector solo tiene _get() — es fisicamente imposible
        escribir en el ERP del cliente via este conector.
        """
        self._setup_stock_connector(tenant_slug)
        try:
            return super().run(tenant_slug, dry_run, limit, min_confidence)
        finally:
            self._teardown_stock_connector()

    def _setup_stock_connector(self, tenant_slug: str) -> None:
        """Configura el conector de stock si el tenant lo soporta.

        Condiciones para activar stock:
        1. erp_type = 'contabilium' (unico ERP con endpoint de stock)
        2. erp_config.stock_warehouse configurado (nombre del deposito)

        Si alguna condicion falla → stock deshabilitado (graceful degradation).
        """
        try:
            tenant_id = get_tenant_id_by_slug(tenant_slug)
            with get_db_connection(tenant_id) as conn:
                row = conn.execute(
                    "SELECT erp_type, erp_config FROM tenants WHERE id = %s",
                    (tenant_id,),
                ).fetchone()

            if not row or row[0] != 'contabilium':
                logger.debug("Stock deshabilitado: tenant no es contabilium")
                return

            erp_config = row[1] or {}
            if isinstance(erp_config, str):
                erp_config = json.loads(erp_config)

            warehouse = erp_config.get('stock_warehouse')
            if not warehouse:
                logger.debug("Stock deshabilitado: stock_warehouse no configurado")
                return

            self._stock_warehouse = warehouse

            # Crear conector con lifecycle de credenciales manejado
            from backend.engine.connectors.contabilium import ContabiliumConnector
            from backend.engine.connectors.crypto import TenantCredentials

            self._stock_creds_cm = TenantCredentials.load(tenant_slug)
            creds = self._stock_creds_cm.__enter__()
            connector = ContabiliumConnector(creds, tenant_id)
            connector.authenticate()
            self._stock_connector = connector

            logger.info(f"Stock connector configurado (deposito: '{warehouse}')")

        except Exception as e:
            logger.warning(
                f"No se pudo configurar stock connector: "
                f"{sanitize_text(str(e))}. Stock deshabilitado."
            )
            self._teardown_stock_connector()

    def _teardown_stock_connector(self) -> None:
        """Limpia el conector de stock y sus credenciales."""
        if self._stock_creds_cm:
            try:
                self._stock_creds_cm.__exit__(None, None, None)
            except Exception:
                pass
        self._stock_connector = None
        self._stock_warehouse = None
        self._stock_creds_cm = None

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
        """Obtiene historial de productos del candidato + stock disponible.

        QUE HACE: Primero obtiene los productos que el cliente compra
        (historial de compras). Si hay conector de stock configurado,
        consulta la API de Contabilium para saber cuantas unidades
        tenemos en deposito de cada producto.

        CONCEPTO - Enriquecimiento de datos:
        Los datos de la DB (historial) se combinan con datos en vivo
        de la API (stock) para tener una imagen mas completa.

        Retorna dict con:
        - 'products': lista enriquecida con stock_disponible
        - 'has_stock_info': True si se consulto stock
        """
        customer_id = str(candidate['customer_id'])
        products = get_product_context(conn, tenant_id, customer_id)

        has_stock_info = False

        # Enriquecer con stock si hay conector configurado
        if self._stock_connector and self._stock_warehouse:
            has_stock_info = True
            from backend.config.settings import SYNC_RATE_LIMIT_DELAY

            for p in products:
                sku = p.get('sku')
                if not sku:
                    p['stock_disponible'] = None  # Sin SKU, no se puede consultar
                    continue

                stock = self._stock_connector.fetch_stock_by_sku(
                    sku, self._stock_warehouse,
                )
                p['stock_disponible'] = stock
                time.sleep(SYNC_RATE_LIMIT_DELAY)

        return {'products': products, 'has_stock_info': has_stock_info}

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
        # Cachear para reusar en build_metadata sin recalcular
        candidate['_cached_factors'] = factors

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

        # Formatear resumen de productos (con stock si hay info)
        products_summary = self._format_products_summary(
            context.get('products', []), today,
            has_stock_info=context.get('has_stock_info', False),
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
        """Extiende metadata base con factores de confianza + stock alert."""
        # Metadata base (incluye profile, sequence_step, etc.)
        meta = super().build_metadata(candidate, context, profile, confidence)

        # Reusar factores cacheados (calculados en calculate_confidence)
        factors = candidate.pop('_cached_factors', None) or self._calculate_factors(candidate, context)
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

        # Stock alert (solo si se consulto stock)
        if context.get('has_stock_info'):
            products_without_stock = []
            products_with_stock = {}
            for p in context.get('products', [])[:6]:
                name = p.get('product_name', '?')
                stock = p.get('stock_disponible')
                if stock is not None and stock > 0:
                    products_with_stock[name] = int(stock)
                elif stock is not None:
                    products_without_stock.append(name)
                # stock=None (desconocido) no se incluye en ninguna lista

            if products_without_stock:
                meta['stock_alert'] = {
                    'products_without_stock': products_without_stock,
                    'products_with_stock': products_with_stock,
                }

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
        self, products: list[dict], today: date, has_stock_info: bool = False,
    ) -> str:
        """Formatea la lista de productos para el prompt.

        Si hay info de stock, agrega [STOCK: N] o [SIN STOCK] a cada linea.
        Claude usa esta info para adaptar el mensaje (ofrecer vs avisar).

        Ejemplo de output con stock:
          - Funda MagSafe iPhone 15: ~36 unidades, ultima hace 56 dias [STOCK: 120]
          - PopGrip MagSafe: ~17 unidades, ultima hace 56 dias [SIN STOCK]
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

            # Info de stock (solo si se consulto la API)
            stock_info = ''
            if has_stock_info:
                stock = p.get('stock_disponible')
                if stock is not None and stock > 0:
                    stock_info = f" [STOCK: {int(stock)}]"
                elif stock is not None:
                    stock_info = " [SIN STOCK]"
                else:
                    stock_info = " [STOCK DESCONOCIDO]"

            lines.append(f"- {name}: ~{avg_qty} unidades{days_ago}{reorder_info}{stock_info}")

        return '\n'.join(lines)
