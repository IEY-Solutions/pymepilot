# Design Doc — Sync de Stock de Deposito + Integracion en Reposicion V2

**Fecha:** 2026-03-11
**Estado:** Aprobado
**Origen:** Brainstorming sesion 2026-03-11

---

## Objetivo

Consultar stock disponible de Contabilium para los productos que aparecen
en cada prediccion de reposicion (V2), enriquecer el prompt de Claude con
esa info, y mostrar alertas visuales cuando hay productos sin stock.

## Restriccion fundamental

**SOLO LECTURA (GET).** Prohibido cualquier otra accion que no sea lectura.
El nuevo metodo usa exclusivamente `_get()` del conector, que solo permite
HTTP GET. No existe `_post()`, `_put()`, ni `_delete()`.

---

## Decisiones clave del brainstorming

| Pregunta | Decision |
|----------|----------|
| Stock de todos los productos o solo candidatos? | Solo productos del candidato (~3-6 por cliente) |
| Filtrar sin stock antes de Claude? | NO. Pasar info a Claude para que adapte el mensaje |
| Que campo usar? | `StockConReservas` (disponible real = actual - reservado) |
| Candidato sin stock en ningun producto? | Se genera prediccion igual, Claude adapta mensaje |
| Donde guardar stock? | En `predictions.metadata` (JSONB), no en tabla nueva |
| Alerta visual? | Banner amarillo en card + recordatorio en modal |

---

## Endpoint de Contabilium

```
GET /api/inventarios/getStockBySKU?codigo={SKU}
```

Respuesta:
- `Id`: ID del concepto (integer)
- `Codigo`: SKU del producto (string)
- `StockActual`: unidades totales (decimal)
- `StockReservado`: unidades reservadas (decimal)
- `StockConReservas`: disponible real = StockActual - StockReservado (decimal)
- `Stock[]`: desglose por deposito (ID, nombre, stock total/reservado/disponible)

---

## Arquitectura del flujo

```
get_context() en reposicion.py
    |
    +-- get_product_context()    <-- ya existe (historial de compras)
    |
    +-- fetch_stock_for_skus()   <-- NUEVO (consulta API Contabilium)
            |
            +-- GET /api/inventarios/getStockBySKU?codigo=SKU1
            +-- GET /api/inventarios/getStockBySKU?codigo=SKU2
            +-- ... (solo productos del candidato, ~3-6 por cliente)
                    |
                    v
            Enriquecer cada producto con stock_disponible
                    |
                    v
            build_prompt_data() -> prompt con stock
                    |
                    v
            Claude genera mensaje adaptado
                    |
                    v
            build_metadata() -> guarda stock_alert en JSONB
                    |
                    v
            Pipeline card -> banner amarillo + recordatorio
```

---

## Cambios por componente

### 1. Conector — ContabiliumConnector

Nuevo metodo `fetch_stock_by_sku(sku: str) -> dict | None`.

- Usa `_get()` existente -> hereda retry, rate limit, batch pacing.
- NO se agrega al ABC (ERPConnector) — no todos los ERPs tienen stock.
- Si el SKU no existe o falla -> retorna None, no rompe el flujo.

### 2. Base de datos — Sin cambios de schema

Stock es volatil (cambia hora a hora). No tiene sentido persistirlo.
Se guarda en `predictions.metadata` (JSONB):

```json
{
  "stock_alert": {
    "products_without_stock": ["PopGrip MagSafe", "Vidrio Templado X"],
    "products_with_stock": {"Funda MagSafe iPhone 15": 120, "Soporte Auto": 45}
  }
}
```

### 3. Vertical reposicion

**get_context():** Despues de obtener productos del cliente, consultar
stock de cada SKU. Agregar `stock_disponible` a cada producto del contexto.

**_format_products_summary():** Incluir stock en cada linea:
```
- Funda MagSafe iPhone 15: ~36 unidades, ultima hace 56 dias [STOCK: 120]
- PopGrip MagSafe: ~17 unidades, ultima hace 56 dias [SIN STOCK]
```

**build_metadata():** Agregar `stock_alert` al JSONB si hay productos sin stock.

### 4. Prompt reposicion.txt

Agregar seccion de stock con instrucciones:
- Producto SIN STOCK -> no ofrecer reservar, avisar que le avisan cuando llegue
- Todos CON stock -> no mencionar stock
- Mix -> priorizar los que tienen stock, mencionar de pasada los que no

### 5. Frontend

**pipeline-card.tsx:** Banner amarillo si `metadata.stock_alert.products_without_stock`
tiene items. Texto: "Sin stock: PopGrip, Vidrio X"

**contact-modal.tsx:** Recuadro debajo del plan de seguimiento:
```
Accion pendiente: Registrar seguimiento para ingreso de stock
Productos sin stock: PopGrip MagSafe, Vidrio Templado X
Cuando llegue stock, contactar a este cliente.
```

---

## Consideraciones

| Tema | Decision |
|------|----------|
| Rate limit | ~3-6 requests extra por candidato. ~60-90 requests adicionales por corrida. Dentro del margen. |
| Fallo de API stock | Asumir stock desconocido, no bloquear prediccion. Loguear warning. |
| Excel/SmartFile | No tienen stock. get_context() detecta tipo de conector y saltea. |
| Producto sin SKU | No se puede consultar. Marcar como "stock desconocido". |
| Seguridad | Solo GET, tenant aislado, sin datos sensibles. |

---

## Archivos a modificar

- `backend/engine/connectors/contabilium.py` — nuevo metodo fetch_stock_by_sku
- `backend/engine/verticales/reposicion.py` — get_context, build_prompt_data, build_metadata
- `backend/config/prompts/reposicion.txt` — instrucciones de stock
- `frontend/src/components/pipeline/pipeline-card.tsx` — banner stock alert
- `frontend/src/components/pipeline/contact-modal.tsx` — recordatorio en modal
- `docs/CONTABILIUM_API.md` — documentar endpoint de stock
