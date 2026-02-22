"""
Motor de sincronizacion ERP → PymePilot.

QUE HACE ESTE ARCHIVO:
Orquesta todo el flujo de sync: descarga datos del ERP (Contabilium o Excel),
los transforma al formato de PymePilot, y los inserta/actualiza en la DB
en una transaccion atomica.

CONCEPTO CLAVE - Dos fases separadas:
  FASE 1 (fetch externo): Descarga datos del ERP via HTTP. Esto puede tardar
  minutos. Se hace FUERA de una transaccion DB para no tener transacciones
  abiertas durante I/O externo (antipatron que PostgreSQL puede matar).
  FASE 2 (upsert DB): Inserta/actualiza datos en la DB. Se hace DENTRO de
  una unica transaccion atomica. Si algo falla: ROLLBACK completo.

CONCEPTO CLAVE - Transaccion atomica:
  Como un paquete de correo: o llega completo o no llega. Si falla el
  upsert de productos, se deshacen tambien los clientes que ya se habian
  insertado en esta transaccion.

CONCEPTO CLAVE - try/finally:
  Garantiza que sync_log NUNCA quede con status='started' indefinidamente.
  No importa como termine run(): el finally se ejecuta SIEMPRE.
"""

import time
from datetime import date

from backend.config.settings import (
    ERP_ENCRYPTION_KEY,
    SYNC_RATE_LIMIT_DELAY,
)
from backend.engine.connectors.base import ERPConnector
from backend.engine.connectors.contabilium import ContabiliumConnector
from backend.engine.connectors.crypto import TenantCredentials, validate_fernet_key
from backend.engine.connectors.excel import ExcelConnector
from backend.engine.core.logger import audit_logs_for_secrets, get_logger, sanitize_text, _LOG_FILE
from backend.engine.db.connection import get_db_connection, get_tenant_id_by_slug

logger = get_logger(__name__)


class SyncEngine:
    """Motor de sincronizacion ERP → PostgreSQL.

    Uso:
        engine = SyncEngine()
        engine.run('iey')  # sync full
        engine.run('iey', since_date=date(2026, 1, 1))  # sync incremental
    """

    def run(
        self,
        tenant_slug: str,
        since_date: date | None = None,
        limit: int | None = None,
        test_only: bool = False,
        connector_override: ERPConnector | None = None,
        source_override: str | None = None,
    ) -> None:
        """Ejecuta sincronizacion completa para un tenant.

        Args:
            tenant_slug: Slug del tenant (ej: 'iey')
            since_date: Si se provee, solo trae ordenes desde esa fecha.
            limit: Si se provee, limita a N registros POR ENTIDAD.
            test_only: Si True, solo prueba la conexion (no sincroniza).
            connector_override: Si se provee, usa este conector en vez de
                crear uno desde la config del tenant en la DB. Util para
                testing con Excel sin cambiar la config real del tenant.
            source_override: Nombre de la fuente para sync_log (ej: 'excel').
                Solo se usa si connector_override esta presente.
        """
        # Paso 1: Validar ERP_ENCRYPTION_KEY (solo si no hay conector externo)
        # Cuando se pasa connector_override, no se necesitan credenciales
        # encriptadas — el conector ya viene listo para usar.
        if connector_override is None and not validate_fernet_key(ERP_ENCRYPTION_KEY):
            raise ValueError(
                "ERP_ENCRYPTION_KEY no configurada o invalida. "
                "Ejecutar: python backend/scripts/setup_credentials.py --init"
            )

        # Paso 2: Buscar tenant en DB → obtener erp_type + tenant_id
        tenant_id = get_tenant_id_by_slug(tenant_slug)
        logger.info(f"Sync iniciado para tenant '{tenant_slug}' (id={tenant_id})")

        # Obtener erp_type del tenant
        with get_db_connection(tenant_id) as conn:
            row = conn.execute(
                "SELECT erp_type FROM tenants WHERE id = %s",
                (tenant_id,)
            ).fetchone()
        erp_type = row[0] if row else None

        # Paso 3: Registrar sync en sync_log
        sync_id = None
        with get_db_connection(tenant_id) as conn:
            # Determinar sync_type segun los parametros
            if limit:
                sync_type = 'limited'
            elif since_date:
                sync_type = 'incremental'
            else:
                sync_type = 'full'

            result = conn.execute(
                """
                INSERT INTO sync_log (tenant_id, sync_type, source, status, started_at)
                VALUES (%(tenant_id)s, %(sync_type)s, %(source)s, 'started', NOW())
                RETURNING id
                """,
                {
                    'tenant_id': tenant_id,
                    'sync_type': sync_type,
                    'source': source_override or erp_type or 'unknown',
                },
            ).fetchone()
            sync_id = result[0]
            conn.commit()  # OBLIGATORIO: sin commit, psycopg3 hace ROLLBACK al devolver conn al pool
            logger.info(f"sync_log registrado: id={sync_id}")

        # Variables para el finally
        original_exception = None

        # === TRY/FINALLY WRAPPER ===
        try:

            # === FASE 1: FETCH EXTERNO (fuera de transaccion DB) ===

            if connector_override is not None:
                # --- PATH ALTERNATIVO: conector provisto externamente ---
                # Se usa para testing (ej: --connector excel --file datos.xlsx)
                # No necesita TenantCredentials ni authenticate().
                connector = connector_override
                connector.test_connection()
                logger.info("test_connection(): OK")

                if test_only:
                    logger.info("--test-only: conexion verificada, sin sincronizar")
                    with get_db_connection(tenant_id) as conn:
                        conn.execute(
                            """
                            UPDATE sync_log SET status = 'completed', completed_at = NOW()
                            WHERE id = %(sync_id)s
                            """,
                            {'sync_id': sync_id},
                        )
                        conn.commit()
                    return

                customers_data, c_truncated = connector.fetch_customers()
                if limit:
                    customers_data = customers_data[:limit]
                logger.info(f"Clientes obtenidos: {len(customers_data)}")

                products_data, p_truncated = connector.fetch_products()
                if limit:
                    products_data = products_data[:limit]
                logger.info(f"Productos obtenidos: {len(products_data)}")

                orders_data, o_truncated = connector.fetch_orders(since_date)
                if limit:
                    orders_data = orders_data[:limit]
                logger.info(f"Ordenes obtenidas: {len(orders_data)}")

            else:
                # --- PATH NORMAL: crear conector desde config del tenant ---
                with TenantCredentials.load(tenant_slug) as creds:
                    # Paso 5: Crear conector apropiado
                    if erp_type == 'contabilium':
                        connector = ContabiliumConnector(creds)
                    elif erp_type == 'excel':
                        # Excel no usa TenantCredentials, pero el with sigue
                        # manejando limpieza por consistencia
                        file_path = creds.client_id  # Para Excel, client_id tiene la ruta
                        connector = ExcelConnector(file_path)
                    else:
                        raise ValueError(f"Tipo de ERP no soportado: {erp_type}")

                    # Paso 6: test_connection
                    if erp_type == 'contabilium':
                        connector.authenticate()
                    connector.test_connection()
                    logger.info("test_connection(): OK")

                    if test_only:
                        logger.info("--test-only: conexion verificada, sin sincronizar")
                        # Actualizar sync_log como completado (test exitoso)
                        with get_db_connection(tenant_id) as conn:
                            conn.execute(
                                """
                                UPDATE sync_log SET status = 'completed', completed_at = NOW()
                                WHERE id = %(sync_id)s
                                """,
                                {'sync_id': sync_id},
                            )
                            conn.commit()
                        return

                    # Pasos 7-9: Fetch datos con rate limiting entre entidades
                    customers_data, c_truncated = connector.fetch_customers()
                    if limit:
                        customers_data = customers_data[:limit]
                    logger.info(f"Clientes obtenidos: {len(customers_data)}")
                    time.sleep(SYNC_RATE_LIMIT_DELAY)

                    products_data, p_truncated = connector.fetch_products()
                    if limit:
                        products_data = products_data[:limit]
                    logger.info(f"Productos obtenidos: {len(products_data)}")
                    time.sleep(SYNC_RATE_LIMIT_DELAY)

                    orders_data, o_truncated = connector.fetch_orders(since_date)
                    if limit:
                        orders_data = orders_data[:limit]
                    logger.info(f"Ordenes obtenidas: {len(orders_data)}")

                # Al salir del with, credenciales se limpian automaticamente
            any_truncated = c_truncated or p_truncated or o_truncated

            # === FASE 2: UPSERT (dentro de una unica transaccion DB) ===
            with get_db_connection(tenant_id) as conn:
                with conn.transaction():
                    # Paso 10a: Upsert customers
                    self._upsert_customers(conn, tenant_id, customers_data)
                    # Paso 10b: Upsert products
                    self._upsert_products(conn, tenant_id, products_data)
                    # Paso 10c: Upsert orders + order_items
                    self._upsert_orders(conn, tenant_id, orders_data)
                    # Paso 10d: Calcular campos derivados
                    self._update_derived_fields(conn, tenant_id)
                # COMMIT automatico al salir de conn.transaction()

                # Paso 11: Actualizar sync_log
                conn.execute(
                    """
                    UPDATE sync_log SET
                        status = %(status)s,
                        customers_synced = %(customers)s,
                        products_synced = %(products)s,
                        orders_synced = %(orders)s,
                        completed_at = NOW()
                    WHERE id = %(sync_id)s
                    """,
                    {
                        'status': 'requires_review' if any_truncated else 'completed',
                        'customers': len(customers_data),
                        'products': len(products_data),
                        'orders': len(orders_data),
                        'sync_id': sync_id,
                    },
                )
                conn.commit()  # Persiste status ANTES de auditoria post-sync

                # Paso 12: Auditoria post-sync
                findings = audit_logs_for_secrets(str(_LOG_FILE))
                if findings > 0:
                    conn.execute(
                        """
                        UPDATE sync_log SET
                            status = 'requires_review',
                            error_message = %(msg)s
                        WHERE id = %(sync_id)s
                        """,
                        {
                            'msg': f'AUDIT: {findings} patron(es) sensible(s) detectado(s) en logs post-sync',
                            'sync_id': sync_id,
                        },
                    )
                    conn.commit()  # Persiste alerta de secrets

            logger.info(
                f"Sync completado para '{tenant_slug}': "
                f"{len(customers_data)} clientes, "
                f"{len(products_data)} productos, "
                f"{len(orders_data)} ordenes"
            )

        except Exception as exc:
            original_exception = exc
            raise

        finally:
            # Paso 13: Garantizar que sync_log NUNCA quede 'started'
            # TODO el contenido del finally envuelto en un UNICO try/except
            try:
                if sync_id is not None:
                    with get_db_connection(tenant_id) as conn:
                        current_status = conn.execute(
                            "SELECT status FROM sync_log WHERE id = %s",
                            (sync_id,)
                        ).fetchone()

                        if current_status and current_status[0] == 'started':
                            error_msg = sanitize_text(str(original_exception)) if original_exception else 'Error desconocido'
                            conn.execute(
                                """
                                UPDATE sync_log SET
                                    status = 'failed',
                                    error_message = %(msg)s,
                                    completed_at = NOW()
                                WHERE id = %(sync_id)s
                                """,
                                {'msg': error_msg, 'sync_id': sync_id},
                            )
                            conn.commit()
                            logger.info(f"sync_log actualizado a 'failed' (id={sync_id})")
            except Exception as finally_exc:
                logger.warning(f"Finally: no se pudo actualizar sync_log: {finally_exc}")

    def _upsert_customers(
        self, conn, tenant_id: str, customers: list[dict]
    ) -> None:
        """Upsert de clientes en tabla customers.

        Mapeo de campos [INFERIDO] — se ajusta en Test 5.
        """
        for c in customers:
            conn.execute(
                """
                INSERT INTO customers (
                    tenant_id, external_id, name, email, phone,
                    address, city, notes
                ) VALUES (
                    %(tenant_id)s, %(external_id)s, %(name)s, %(email)s,
                    %(phone)s, %(address)s, %(city)s, %(notes)s
                )
                ON CONFLICT (tenant_id, external_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city,
                    notes = EXCLUDED.notes,
                    updated_at = NOW()
                """,
                {
                    'tenant_id': tenant_id,
                    'external_id': str(c.get('Id', '')),
                    'name': c.get('RazonSocial') or c.get('Nombre', ''),
                    'email': c.get('Email'),
                    'phone': c.get('Telefono'),
                    'address': c.get('Domicilio'),
                    'city': c.get('Localidad'),
                    'notes': c.get('Observaciones'),
                },
            )

        logger.info(f"Upsert clientes: {len(customers)} procesados")

    def _upsert_products(
        self, conn, tenant_id: str, products: list[dict]
    ) -> None:
        """Upsert de productos en tabla products.

        Mapeo de campos [INFERIDO] — se ajusta en Test 5.
        """
        for p in products:
            conn.execute(
                """
                INSERT INTO products (
                    tenant_id, external_id, sku, name,
                    category, subcategory, price
                ) VALUES (
                    %(tenant_id)s, %(external_id)s, %(sku)s, %(name)s,
                    %(category)s, %(subcategory)s, %(price)s
                )
                ON CONFLICT (tenant_id, external_id) DO UPDATE SET
                    sku = EXCLUDED.sku,
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    subcategory = EXCLUDED.subcategory,
                    price = EXCLUDED.price,
                    updated_at = NOW()
                """,
                {
                    'tenant_id': tenant_id,
                    'external_id': str(p.get('Id', '')),
                    'sku': p.get('Codigo'),
                    'name': p.get('Nombre', ''),
                    'category': p.get('Rubro'),
                    'subcategory': p.get('SubRubro'),
                    'price': p.get('PrecioVenta'),
                },
            )

        logger.info(f"Upsert productos: {len(products)} procesados")

    def _upsert_orders(
        self, conn, tenant_id: str, orders: list[dict]
    ) -> None:
        """Upsert de ordenes + items en tablas orders y order_items.

        orders: ON CONFLICT (tenant_id, external_id) DO UPDATE
        order_items: DELETE existentes + INSERT nuevos (no tiene UNIQUE para upsert)
        """
        for o in orders:
            # Resolver customer_id via external_id lookup
            customer_external_id = None
            cliente = o.get('Cliente', {})
            if isinstance(cliente, dict):
                customer_external_id = str(cliente.get('Id', ''))
            elif isinstance(cliente, (int, str)):
                customer_external_id = str(cliente)

            customer_id = None
            if customer_external_id:
                row = conn.execute(
                    """
                    SELECT id FROM customers
                    WHERE tenant_id = %(tenant_id)s AND external_id = %(eid)s
                    """,
                    {'tenant_id': tenant_id, 'eid': customer_external_id},
                ).fetchone()
                if row:
                    customer_id = row[0]

            # Upsert orden (customer_id es NOT NULL — si no se encuentra, saltamos)
            if customer_id is None:
                logger.warning(
                    f"Orden external_id={o.get('Id')} sin customer_id resuelto. "
                    f"Cliente external_id={customer_external_id} no encontrado. Saltando."
                )
                continue

            result = conn.execute(
                """
                INSERT INTO orders (
                    tenant_id, external_id, customer_id,
                    order_date, total_amount, status
                ) VALUES (
                    %(tenant_id)s, %(external_id)s, %(customer_id)s,
                    %(order_date)s, %(total_amount)s, 'completed'
                )
                ON CONFLICT (tenant_id, external_id) DO UPDATE SET
                    customer_id = EXCLUDED.customer_id,
                    order_date = EXCLUDED.order_date,
                    total_amount = EXCLUDED.total_amount
                RETURNING id
                """,
                {
                    'tenant_id': tenant_id,
                    'external_id': str(o.get('Id', '')),
                    'customer_id': customer_id,
                    'order_date': o.get('Fecha'),
                    'total_amount': o.get('Total'),
                },
            ).fetchone()

            order_id = result[0]

            # order_items: DELETE existentes + INSERT nuevos
            conn.execute(
                "DELETE FROM order_items WHERE order_id = %(order_id)s AND tenant_id = %(tenant_id)s",
                {'order_id': order_id, 'tenant_id': tenant_id},
            )

            items = o.get('Items', [])
            if isinstance(items, list):
                for item in items:
                    # Resolver product_id via external_id lookup
                    product_id = None
                    concepto = item.get('Concepto', {})
                    if isinstance(concepto, dict):
                        product_external_id = str(concepto.get('Id', ''))
                        if product_external_id:
                            prow = conn.execute(
                                """
                                SELECT id FROM products
                                WHERE tenant_id = %(tenant_id)s AND external_id = %(eid)s
                                """,
                                {'tenant_id': tenant_id, 'eid': product_external_id},
                            ).fetchone()
                            if prow:
                                product_id = prow[0]

                    product_name = ''
                    if isinstance(concepto, dict):
                        product_name = concepto.get('Nombre', '')

                    conn.execute(
                        """
                        INSERT INTO order_items (
                            tenant_id, order_id, product_id, product_name,
                            quantity, unit_price, total_price
                        ) VALUES (
                            %(tenant_id)s, %(order_id)s, %(product_id)s,
                            %(product_name)s, %(quantity)s, %(unit_price)s,
                            %(total_price)s
                        )
                        """,
                        {
                            'tenant_id': tenant_id,
                            'order_id': order_id,
                            'product_id': product_id,
                            'product_name': product_name,
                            'quantity': item.get('Cantidad') or 0,
                            'unit_price': item.get('PrecioUnitario') or 0,
                            'total_price': item.get('Total') or 0,
                        },
                    )

        logger.info(f"Upsert ordenes: {len(orders)} procesadas")

    def _update_derived_fields(self, conn, tenant_id: str) -> None:
        """Calcula campos derivados de clientes con una sola query UPDATE...FROM.

        avg_days: dias entre primera y ultima compra / (cantidad - 1).
        Si solo tiene 1 orden → NULL (no hay intervalo calculable).
        Solo cuenta ordenes con status='completed'.
        """
        conn.execute(
            """
            UPDATE customers AS c SET
                first_purchase_date = sub.first_date,
                last_purchase_date  = sub.last_date,
                total_purchases_count = sub.order_count,
                total_purchases_amount = sub.total_amount,
                avg_days_between_purchases = sub.avg_days
            FROM (
                SELECT
                    o.customer_id,
                    MIN(o.order_date)  AS first_date,
                    MAX(o.order_date)  AS last_date,
                    COUNT(*)           AS order_count,
                    COALESCE(SUM(o.total_amount), 0) AS total_amount,
                    CASE WHEN COUNT(*) > 1 THEN
                        (MAX(o.order_date) - MIN(o.order_date))::numeric
                        / (COUNT(*) - 1)
                    ELSE NULL END AS avg_days
                FROM orders o
                WHERE o.tenant_id = %(tenant_id)s
                  AND o.status = 'completed'
                GROUP BY o.customer_id
            ) AS sub
            WHERE c.id = sub.customer_id
              AND c.tenant_id = %(tenant_id)s
            """,
            {'tenant_id': tenant_id},
        )

        logger.info("Campos derivados de clientes actualizados")
