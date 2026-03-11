# Contabilium API - Referencia para PymePilot

**Ultima actualizacion:** 2026-02-22
**Estado:** Endpoints [INFERIDOS] desde wrapper Laravel publico. Pendientes de verificacion con requests reales.

---

## Autenticacion

- **URL:** `POST https://rest.contabilium.com/token`
- **Content-Type:** `application/x-www-form-urlencoded`
- **Parametros:**
  - `grant_type=client_credentials`
  - `client_id={email}` (email de la cuenta Contabilium)
  - `client_secret={token_api}` (token generado en Mi Cuenta > Config > API)
- **Respuesta:** JSON con `access_token` y `expires_in`
- **Uso posterior:** Header `Authorization: Bearer {access_token}`

**Nota:** Este es el UNICO POST que hace PymePilot. Todos los demas requests son GET.

---

## Endpoints (SOLO GET)

| Recurso | Endpoint | Parametros |
|---------|----------|------------|
| Clientes | `GET api/clientes/search` | `filtro`, `page`, `pageSize` |
| Cliente por ID | `GET api/clientes?id=X` | `id` |
| Productos | `GET api/conceptos/search` | `filtro`, `page`, `pageSize` |
| Producto por codigo | `GET api/conceptos?codigo=X` | `codigo` |
| Comprobantes (facturas) | `GET api/comprobantes/search` | `filtro`, `fechaDesde`, `fechaHasta`, `page` |
| Comprobante por ID | `GET api/comprobantes?id=X` | `id` |
| Stock por SKU | `GET api/inventarios/getStockBySKU?codigo=X` | `codigo` |

### Paginacion

- `page`: numero de pagina (empieza en 1)
- `pageSize`: cantidad por pagina (usamos 50)
- Pagina vacia o con menos de `pageSize` registros = ultima pagina

---

## Base URL

```
https://rest.contabilium.com
```

El endpoint de autenticacion es `/token` (sin `/api`).
Los endpoints de datos usan el prefijo `/api`.

---

## Mapeo de campos: Contabilium -> PymePilot

> Estado: [INFERIDO] = basado en wrapper Laravel, pendiente verificacion.
> Despues del primer sync con --limit 5, actualizar a [CONFIRMADO].

### Clientes (api/clientes/search -> customers)

| Contabilium | PymePilot (customers) | Estado |
|-------------|----------------------|--------|
| Id | external_id | [INFERIDO] |
| RazonSocial / Nombre | name | [INFERIDO] |
| Email | email | [INFERIDO] |
| Telefono | phone | [INFERIDO] |
| Domicilio | address | [INFERIDO] |
| Localidad | city | [INFERIDO] |
| Observaciones | notes | [INFERIDO] |

### Productos (api/conceptos/search -> products)

| Contabilium | PymePilot (products) | Estado |
|-------------|---------------------|--------|
| Id | external_id | [INFERIDO] |
| Codigo | sku | [INFERIDO] |
| Nombre | name | [INFERIDO] |
| Rubro | category | [INFERIDO] |
| SubRubro | subcategory | [INFERIDO] |
| PrecioVenta | price | [INFERIDO] |

### Comprobantes (api/comprobantes/search -> orders)

| Contabilium | PymePilot (orders) | Estado |
|-------------|-------------------|--------|
| Id | external_id | [INFERIDO] |
| Fecha | order_date | [INFERIDO] |
| Total | total_amount | [INFERIDO] |
| Cliente.Id | customer_id (via external_id lookup) | [INFERIDO] |
| Items[] | -> order_items | [INFERIDO] |

### Items de comprobante (Items[] -> order_items)

| Contabilium (item) | PymePilot (order_items) | Estado |
|--------------------|----------------------|--------|
| Concepto.Id | product_id (via external_id lookup) | [INFERIDO] |
| Concepto.Nombre | product_name | [INFERIDO] |
| Cantidad | quantity | [INFERIDO] |
| PrecioUnitario | unit_price | [INFERIDO] |
| Total | total_price | [INFERIDO] |

---

## Proceso de verificacion

1. Ejecutar `sync_erp.py --tenant-slug iey --limit 5`
2. Revisar datos recibidos vs campos esperados
3. Actualizar cada campo a [CONFIRMADO] si coincide
4. Corregir nombre en columna "Contabilium" si difiere

---

### Stock por SKU (api/inventarios/getStockBySKU)

| Contabilium | Descripcion | Tipo |
|-------------|-------------|------|
| Id | ID del concepto | integer |
| Codigo | SKU del producto | string |
| StockActual | Unidades totales en la cuenta | decimal |
| StockReservado | Unidades reservadas totales | decimal |
| StockConReservas | Disponible = Actual - Reservado | decimal |
| Stock[] | Array de depositos | array |
| Stock[].Id | ID del deposito | integer |
| Stock[].Codigo | Nombre del deposito | string |
| Stock[].StockActual | Unidades totales en deposito | decimal |
| Stock[].StockReservado | Unidades reservadas en deposito | decimal |
| Stock[].StockConReservas | Disponible en deposito | decimal |

**Uso:** Se consulta por producto (SKU) durante la vertical de reposicion.
Solo se usa el stock del deposito configurado en `erp_config.stock_warehouse`
del tenant (comparacion case-insensitive). Para IEY: "oficina".

---

## Restricciones de seguridad

- **SOLO LECTURA:** PymePilot nunca escribe en Contabilium (solo GET)
- **Rate limiting:** 0.5s entre requests, backoff exponencial en 429
- **Credenciales:** Encriptadas con Fernet en la DB, nunca en texto plano
- **API key:** Solicitar permisos de SOLO LECTURA en Contabilium
