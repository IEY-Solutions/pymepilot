"""
Queries SQL para el motor de verticales de PymePilot.

QUE HACE ESTE ARCHIVO:
Centraliza TODAS las consultas SQL que usa el motor de predicciones.
Ningun otro archivo del proyecto escribe SQL para predicciones — todo
pasa por aca. Esto facilita auditar, optimizar, y modificar queries.

CONCEPTO CLAVE - Repository Pattern (simplificado):
En vez de mezclar SQL con logica de negocio (como en un guiso donde
no distinguis los ingredientes), separamos las "recetas de datos" en
un solo lugar. Cada funcion hace UNA consulta y retorna datos limpios.

PATRON DE USO:
Todas las funciones reciben `conn` (conexion con tenant context ya seteado)
y `tenant_id` (filtro explicito como capa extra de seguridad sobre RLS).
Retornan listas de dicts o dicts individuales, usando psycopg3 dict_row.

NOTA SOBRE RLS:
Las queries ya estan protegidas por RLS (el tenant context se setea
al obtener la conexion). El filtro `tenant_id = %(tenant_id)s` es
una SEGUNDA capa de seguridad — si RLS falla por algun motivo, el
filtro explicito sigue protegiendo.
"""

import json
from datetime import date
from decimal import Decimal

from psycopg.rows import dict_row

from backend.engine.core.logger import get_logger

logger = get_logger(__name__)


# ============================================================
# QUERY 1: Candidatos para reposicion
# ============================================================

def get_reorder_candidates(
    conn,
    tenant_id: str,
    days_ahead: int = 14,
    days_overdue: int = 7,
) -> list[dict]:
    """Busca clientes que estan proximos a necesitar reposicion.

    QUE HACE: Calcula una "fecha predicha de proxima compra" para cada
    cliente (last_purchase_date + avg_days) y devuelve los que caen
    dentro de una ventana de contacto.

    COMO LO CALCULA:
      predicted_date = ultima compra + promedio de dias entre compras
      days_until = predicted_date - hoy
      Si days_until esta entre -days_overdue y +days_ahead → candidato

    FILTROS:
      - Minimo 2 compras (sino no hay promedio)
      - Status activo
      - No tiene prediccion activa (pending/contacted) de reposicion

    Args:
        conn: Conexion con tenant context.
        tenant_id: UUID del tenant (filtro explicito sobre RLS).
        days_ahead: Cuantos dias hacia adelante buscar (default 14).
        days_overdue: Cuantos dias de atraso incluir (default 7).

    Returns:
        Lista de dicts con datos del candidato. Vacia si no hay candidatos.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                c.id AS customer_id,
                c.name,
                c.email,
                c.phone,
                c.total_purchases_count,
                c.total_purchases_amount,
                c.avg_days_between_purchases,
                c.stddev_days_between_purchases,
                c.last_purchase_date,
                c.first_purchase_date,
                -- Fecha predicha de proxima compra
                (c.last_purchase_date
                    + c.avg_days_between_purchases::integer
                ) AS predicted_date,
                -- Dias hasta la fecha predicha (negativo = vencido)
                (c.last_purchase_date
                    + c.avg_days_between_purchases::integer
                    - CURRENT_DATE
                ) AS days_until_predicted
            FROM customers c
            WHERE c.tenant_id = %(tenant_id)s
              AND c.status = 'active'
              AND c.total_purchases_count >= 2
              AND c.avg_days_between_purchases IS NOT NULL
              -- Dentro de la ventana de contacto
              AND (c.last_purchase_date
                  + c.avg_days_between_purchases::integer
                  - CURRENT_DATE
              ) BETWEEN %(overdue)s AND %(ahead)s
              -- Sin prediccion activa existente
              AND NOT EXISTS (
                  SELECT 1 FROM predictions p
                  WHERE p.customer_id = c.id
                    AND p.tenant_id = c.tenant_id
                    AND p.vertical = 'reposicion'
                    AND p.status IN ('pending', 'contacted')
              )
            ORDER BY
                -- Mas urgentes primero (menor days_until)
                (c.last_purchase_date
                    + c.avg_days_between_purchases::integer
                    - CURRENT_DATE
                )
            """,
            {
                'tenant_id': tenant_id,
                'overdue': -days_overdue,
                'ahead': days_ahead,
            },
        )
        candidates = cur.fetchall()

    logger.info(f"Candidatos reposicion encontrados: {len(candidates)}")
    return candidates


# ============================================================
# QUERY 2: Contexto de productos por cliente
# ============================================================

def get_product_context(
    conn,
    tenant_id: str,
    customer_id: str,
) -> list[dict]:
    """Obtiene el historial de compras de un cliente desglosado por producto.

    QUE HACE: Para cada producto que el cliente compro alguna vez,
    calcula cuantas veces lo compro, cantidad promedio, ultima vez,
    y el ritmo de recompra especifico de ESE producto.

    POR QUE POR PRODUCTO: No es lo mismo decir "Juan necesita comprar"
    que "Juan necesita 50 Fundas MagSafe". El desglose por producto
    hace el mensaje mucho mas util y especifico.

    CONCEPTO CLAVE - LAG() Window Function:
    Igual que en _update_derived_fields, usamos LAG para mirar la
    orden anterior de ESTE producto por ESTE cliente. Asi calculamos
    cada cuanto recompra cada producto especifico.

    Args:
        conn: Conexion con tenant context.
        tenant_id: UUID del tenant.
        customer_id: UUID del cliente.

    Returns:
        Lista de dicts, un dict por producto, ordenados por frecuencia.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            WITH product_orders AS (
                -- Cada compra de cada producto por este cliente,
                -- con la fecha de la compra anterior de ESE producto
                SELECT
                    oi.product_id,
                    o.order_date,
                    oi.quantity,
                    oi.total_price,
                    (o.order_date - LAG(o.order_date) OVER (
                        PARTITION BY oi.product_id
                        ORDER BY o.order_date
                    ))::numeric AS days_gap
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE oi.tenant_id = %(tenant_id)s
                  AND o.customer_id = %(customer_id)s
                  AND o.status = 'completed'
                  AND oi.product_id IS NOT NULL
            )
            SELECT
                po.product_id,
                p.name AS product_name,
                p.category,
                p.price AS current_price,
                COUNT(*) AS times_ordered,
                SUM(po.quantity) AS total_quantity,
                ROUND(AVG(po.quantity)) AS avg_quantity,
                MAX(po.order_date) AS last_ordered,
                SUM(po.total_price) AS total_spent,
                -- Ritmo de recompra de ESTE producto (NULL si solo 1 compra)
                CASE WHEN COUNT(po.days_gap) >= 1 THEN
                    ROUND(AVG(po.days_gap))
                ELSE NULL END AS avg_days_between_orders,
                -- Fecha predicha de recompra de ESTE producto
                CASE WHEN COUNT(po.days_gap) >= 1 THEN
                    MAX(po.order_date)
                    + ROUND(AVG(po.days_gap))::integer
                ELSE NULL END AS predicted_reorder_date
            FROM product_orders po
            JOIN products p ON p.id = po.product_id
            GROUP BY po.product_id, p.name, p.category, p.price
            ORDER BY COUNT(*) DESC, SUM(po.total_price) DESC
            """,
            {
                'tenant_id': tenant_id,
                'customer_id': customer_id,
            },
        )
        products = cur.fetchall()

    logger.debug(
        f"Contexto de productos para cliente {customer_id}: "
        f"{len(products)} productos encontrados"
    )
    return products


# ============================================================
# QUERY 3: Umbral de percentil de facturacion (para VIP)
# ============================================================

def get_revenue_percentile_threshold(
    conn,
    tenant_id: str,
    percentile: float = 0.80,
) -> float:
    """Calcula el monto de facturacion que marca el percentil dado.

    QUE HACE: Responde la pregunta "¿cuanto tiene que facturar un
    cliente para estar en el top 20%?" Si el resultado es $50,000,
    cualquier cliente con total_purchases_amount >= 50,000 es VIP.

    CONCEPTO CLAVE - PERCENTILE_CONT:
    Funcion de PostgreSQL que calcula percentiles. PERCENTILE_CONT(0.80)
    devuelve el valor que separa el 80% inferior del 20% superior.
    Es como preguntar "¿cual es la nota minima para estar en el top 20%?"

    Args:
        conn: Conexion con tenant context.
        tenant_id: UUID del tenant.
        percentile: Percentil a calcular (0.80 = top 20%).

    Returns:
        Monto en pesos que marca el umbral. 0.0 si no hay datos.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT COALESCE(
                PERCENTILE_CONT(%(percentile)s) WITHIN GROUP (
                    ORDER BY total_purchases_amount
                ),
                0
            ) AS threshold
            FROM customers
            WHERE tenant_id = %(tenant_id)s
              AND total_purchases_count >= 2
            """,
            {
                'tenant_id': tenant_id,
                'percentile': percentile,
            },
        )
        row = cur.fetchone()

    threshold = float(row['threshold']) if row else 0.0
    logger.debug(f"Percentil {percentile:.0%} de facturacion: ${threshold:,.2f}")
    return threshold


# ============================================================
# QUERY 4: Verificar prediccion existente (dedup explicito)
# ============================================================

def check_existing_prediction(
    conn,
    tenant_id: str,
    customer_id: str,
    vertical: str,
    prediction_date: date,
) -> bool:
    """Verifica si ya existe una prediccion activa para esta combinacion.

    QUE HACE: Antes de crear una prediccion nueva, verifica que no
    exista una activa (pending/contacted) para el mismo cliente +
    vertical + fecha. Es una verificacion EXPLICITA ademas del indice
    UNIQUE idx_predictions_dedup (que es la red de seguridad en DB).

    POR QUE DOBLE CHEQUEO: El indice UNIQUE atrapa errores a nivel DB,
    pero es mejor verificar ANTES de intentar el INSERT. Asi evitamos
    excepciones innecesarias y podemos loggear limpiamente.

    Args:
        conn: Conexion con tenant context.
        tenant_id: UUID del tenant.
        customer_id: UUID del cliente.
        vertical: Tipo de vertical ('reposicion', etc).
        prediction_date: Fecha de la prediccion.

    Returns:
        True si ya existe una prediccion activa, False si no.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM predictions
                WHERE tenant_id = %(tenant_id)s
                  AND customer_id = %(customer_id)s
                  AND vertical = %(vertical)s
                  AND prediction_date = %(prediction_date)s
                  AND status IN ('pending', 'contacted')
            )
            """,
            {
                'tenant_id': tenant_id,
                'customer_id': customer_id,
                'vertical': vertical,
                'prediction_date': prediction_date,
            },
        )
        row = cur.fetchone()

    return row[0] if row else False


# ============================================================
# QUERY 5: Guardar prediccion
# ============================================================

def save_prediction(
    conn,
    tenant_id: str,
    customer_id: str,
    vertical: str,
    prediction_date: date,
    contact_date: date | None,
    message_text: str | None,
    suggested_products: list[dict] | None,
    confidence_score: float | None,
    priority: int,
    metadata: dict | None,
) -> str:
    """Inserta una nueva prediccion en la tabla predictions.

    QUE HACE: Guarda el resultado del motor — la prediccion completa
    con mensaje, score de confianza, prioridad, y metadata.

    CONCEPTO CLAVE - RETURNING id:
    En vez de hacer INSERT y despues SELECT para obtener el ID del
    registro creado, PostgreSQL permite hacer ambas en una sola query.

    Args:
        conn: Conexion con tenant context (DENTRO de transaccion).
        tenant_id: UUID del tenant.
        customer_id: UUID del cliente.
        vertical: Tipo de vertical ('reposicion', etc).
        prediction_date: Fecha de la prediccion (hoy).
        contact_date: Fecha sugerida para contactar al cliente.
        message_text: Mensaje generado por Claude (None si dry-run).
        suggested_products: Lista de productos sugeridos (JSONB).
        confidence_score: Score de confianza (0.0 a 1.0).
        priority: Prioridad (1=maxima a 5=minima).
        metadata: Datos adicionales (perfil, factores, etc).

    Returns:
        UUID del registro creado (como string).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO predictions (
                tenant_id, customer_id, vertical, prediction_date,
                contact_date, message_text, suggested_products,
                confidence_score, priority, status, metadata
            ) VALUES (
                %(tenant_id)s, %(customer_id)s, %(vertical)s,
                %(prediction_date)s, %(contact_date)s, %(message_text)s,
                %(suggested_products)s::jsonb, %(confidence_score)s,
                %(priority)s, 'pending', %(metadata)s::jsonb
            )
            RETURNING id
            """,
            {
                'tenant_id': tenant_id,
                'customer_id': customer_id,
                'vertical': vertical,
                'prediction_date': prediction_date,
                'contact_date': contact_date,
                'message_text': message_text,
                'suggested_products': json.dumps(
                    suggested_products or []
                ),
                'confidence_score': confidence_score,
                'priority': priority,
                'metadata': json.dumps(metadata or {}),
            },
        )
        row = cur.fetchone()

    prediction_id = str(row[0])
    logger.info(
        f"Prediccion guardada: {prediction_id} "
        f"(cliente={customer_id}, vertical={vertical}, priority={priority})"
    )
    return prediction_id


# ============================================================
# QUERY 6: Predicciones pendientes para atribucion
# ============================================================

def get_predictions_for_attribution(
    conn,
    tenant_id: str,
    attribution_window_days: int = 14,
) -> list[dict]:
    """Busca predicciones activas que tengan compras recientes del cliente.

    QUE HACE: Despues de cada sync (que trae compras nuevas del ERP),
    busca predicciones en status pending/contacted donde el cliente
    compro dentro de los N dias siguientes a la prediccion. Esas
    compras se atribuyen a PymePilot automaticamente.

    CONCEPTO CLAVE - Atribucion automatica:
    Si PymePilot predijo que Juan necesitaba comprar, y Juan compro
    dentro de 14 dias, asumimos que la prediccion ayudo. No necesita
    que el vendedor confirme nada. Es como un gol que se cuenta solo
    si la pelota entro en el arco (la compra existe en el ERP).

    Args:
        conn: Conexion con tenant context.
        tenant_id: UUID del tenant.
        attribution_window_days: Dias despues de la prediccion para
            buscar compras (default 14).

    Returns:
        Lista de dicts con prediccion + datos de la compra.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                pred.id AS prediction_id,
                pred.customer_id,
                pred.prediction_date,
                pred.confidence_score,
                pred.priority,
                -- Datos de la compra atribuible
                o.id AS order_id,
                o.order_date,
                o.total_amount AS order_amount,
                -- Dias entre prediccion y compra
                (o.order_date - pred.prediction_date) AS days_to_purchase
            FROM predictions pred
            JOIN orders o
              ON o.customer_id = pred.customer_id
              AND o.tenant_id = pred.tenant_id
              AND o.status = 'completed'
              -- Compra fue DESPUES de la prediccion
              AND o.order_date >= pred.prediction_date
              -- Dentro de la ventana de atribucion
              AND o.order_date <= pred.prediction_date
                  + %(window)s
            WHERE pred.tenant_id = %(tenant_id)s
              AND pred.vertical = 'reposicion'
              AND pred.status IN ('pending', 'contacted')
            ORDER BY pred.prediction_date
            """,
            {
                'tenant_id': tenant_id,
                'window': attribution_window_days,
            },
        )
        results = cur.fetchall()

    logger.info(f"Predicciones con compras atribuibles: {len(results)}")
    return results


# ============================================================
# QUERY 7: Marcar prediccion como convertida
# ============================================================

def update_prediction_attribution(
    conn,
    tenant_id: str,
    prediction_id: str,
    order_id: str,
    order_amount: Decimal,
) -> None:
    """Marca una prediccion como completada con datos de atribucion.

    QUE HACE: Cambia el status de pending/contacted → completed,
    y guarda en metadata los datos de la compra que la convirtio.

    CONCEPTO CLAVE - jsonb_build_object + || (merge):
    En PostgreSQL, el operador || sobre JSONB "mergea" dos objetos.
    Asi agregamos campos nuevos a metadata sin perder los existentes.

    Args:
        conn: Conexion con tenant context.
        tenant_id: UUID del tenant (filtro explicito sobre RLS).
        prediction_id: UUID de la prediccion.
        order_id: UUID de la orden que la convirtio.
        order_amount: Monto de la orden.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE predictions SET
                status = 'completed',
                metadata = metadata || jsonb_build_object(
                    'attribution_order_id', %(order_id)s,
                    'attribution_amount', %(order_amount)s,
                    'attribution_date', CURRENT_DATE::text,
                    'attributed_automatically', true
                )
            WHERE id = %(prediction_id)s
              AND tenant_id = %(tenant_id)s
            """,
            {
                'tenant_id': tenant_id,
                'prediction_id': prediction_id,
                'order_id': order_id,
                'order_amount': float(order_amount),
            },
        )

    logger.info(
        f"Prediccion {prediction_id} atribuida: "
        f"orden={order_id}, monto=${order_amount:,.2f}"
    )


# ============================================================
# QUERY 8: Resumen de run
# ============================================================

def get_run_summary(
    conn,
    tenant_id: str,
    run_date: date | None = None,
) -> dict:
    """Obtiene resumen de predicciones generadas en una fecha.

    QUE HACE: Despues de que el motor corre, esta query genera un
    resumen rapido: cuantas predicciones se crearon, distribucion
    por prioridad, confianza promedio, y facturacion potencial.

    Args:
        conn: Conexion con tenant context.
        tenant_id: UUID del tenant.
        run_date: Fecha del run (default: hoy).

    Returns:
        Dict con total, by_priority, avg_confidence, total_potential_value.
    """
    if run_date is None:
        run_date = date.today()

    with conn.cursor(row_factory=dict_row) as cur:
        # Resumen general
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_predictions,
                ROUND(AVG(confidence_score), 3) AS avg_confidence,
                COUNT(*) FILTER (WHERE priority <= 2) AS high_priority,
                COUNT(*) FILTER (WHERE priority = 3) AS medium_priority,
                COUNT(*) FILTER (WHERE priority >= 4) AS low_priority
            FROM predictions
            WHERE tenant_id = %(tenant_id)s
              AND vertical = 'reposicion'
              AND prediction_date = %(run_date)s
            """,
            {'tenant_id': tenant_id, 'run_date': run_date},
        )
        summary = cur.fetchone()

        # Facturacion potencial (sum de total_purchases_amount de los candidatos)
        cur.execute(
            """
            SELECT COALESCE(SUM(c.total_purchases_amount), 0) AS potential_value
            FROM predictions p
            JOIN customers c ON c.id = p.customer_id
            WHERE p.tenant_id = %(tenant_id)s
              AND p.vertical = 'reposicion'
              AND p.prediction_date = %(run_date)s
            """,
            {'tenant_id': tenant_id, 'run_date': run_date},
        )
        value_row = cur.fetchone()

    result = {
        'total_predictions': summary['total_predictions'] if summary else 0,
        'avg_confidence': float(summary['avg_confidence'] or 0) if summary else 0,
        'high_priority': summary['high_priority'] if summary else 0,
        'medium_priority': summary['medium_priority'] if summary else 0,
        'low_priority': summary['low_priority'] if summary else 0,
        'potential_value': float(
            value_row['potential_value']
        ) if value_row else 0,
        'run_date': str(run_date),
    }

    logger.info(
        f"Resumen del run {run_date}: {result['total_predictions']} predicciones, "
        f"confianza promedio {result['avg_confidence']:.3f}, "
        f"valor potencial ${result['potential_value']:,.2f}"
    )
    return result
