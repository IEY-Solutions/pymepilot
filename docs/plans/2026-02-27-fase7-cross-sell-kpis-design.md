# Fase 7: V3 Cross-Sell + KPIs Avanzados + Ranking Clientes — Design Doc

**Fecha:** 2026-02-27
**Estado:** Aprobado
**Prerequisito:** Fase 6 Parte 1 completada, Fases 0-5 auditadas (0C/0H)

---

## Contexto

PymePilot tiene 3 verticales operativas (V2 Reposicion, V1 Activacion, V4 Recuperacion)
cubriendo el ciclo: cliente nuevo -> recurrente -> en riesgo. Falta V3 Cross-Sell para
maximizar el valor de cada cliente activo recomendando productos que nunca compro pero
clientes similares si.

Ademas, el dashboard muestra 4 KPIs basicos (pendientes, tasa contacto, clientes activos,
ultima sync). Fase 7 agrega metricas de valor real: facturacion recurrente, churn, ticket
promedio, y valor generado por PymePilot.

---

## Decisiones de diseno (aprobadas por Pato)

| Decision | Resultado |
|----------|-----------|
| Logica V3 | Co-compras automaticas ("clientes que compran X tambien compran Y") |
| Umbral co-compra | >= 30% de rate para recomendar |
| Max productos | 3 productos recomendados por mensaje |
| Frecuencia V3 | Semanal (lunes), no diario |
| KPIs nuevos | 4: facturacion recurrente, churn, ticket promedio, valor PymePilot |
| Graficos | Recharts (libreria React), 4 graficos interactivos |
| Reportes | Excel (4 hojas) + PDF (resumen ejecutivo), client-side |
| Ranking clientes | Tab dentro de /metricas, refresh diario con orquestador |
| Navegacion | /metricas con 2 tabs: "Rendimiento" y "Clientes" |
| Refresh vistas | Diario a las 5 AM con el orquestador (2 vistas materializadas) |

---

## V3 Cross-Sell

### Logica de candidatos

1. **Analizar co-compras** de todos los clientes del tenant via vista materializada
   `co_purchases`. "Producto A se compra junto con Producto B en el 75% de los casos."

2. **Por cada cliente activo:**
   - Buscar productos que NUNCA compro pero clientes similares si
   - Filtrar: solo recomendar si co_purchase_rate >= 0.30 (30%)

3. **Excluir:**
   - Clientes con prediccion V3 activa (dedup)
   - Clientes con prediccion V2 pendiente (no saturar)
   - Clientes inactivos > 60 dias (esos van a V4)
   - Clientes con 0 o 1 compra (poco historial para cross-sell)

4. **Priorizar por:**
   - Cantidad de productos "perdidos" (mas oportunidades = mas valor)
   - Monto historico del cliente (VIP primero)
   - Fuerza de la co-compra (75% > 30%)

### Factores de confianza (4 factores)

| Factor | Peso | Que mide |
|--------|------|----------|
| `co_purchase_strength` | 35% | Fuerza del patron de co-compra (75% vs 30%) |
| `customer_history` | 25% | Cantidad de compras del cliente (mas datos = mas confianza) |
| `product_popularity` | 20% | Popularidad del producto recomendado (mas comprado = menos riesgo) |
| `recency` | 20% | Recencia de ultima compra (mas reciente = mas probable que acepte) |

### Frecuencia y ejecucion

- V3 se ejecuta **1 vez por semana** (lunes)
- El orquestador verifica `day_of_week == 0` (Monday) antes de ejecutar V3
- Solo genera predicciones si no hay V3 pendiente para ese cliente
- Maximo 3 productos recomendados por mensaje

### Prompt cross_sell.txt

Estructura:
```
===SYSTEM===
Rol: asistente comercial de distribuidor mayorista
Tarea: sugerir productos que el cliente nunca compro
Tono: natural, sin presion, como sugerencia de valor
Formato: 5 oraciones + 1 pregunta
Regla: mencionar que "otros clientes similares" compran estos productos
===USER===
Cliente: {customer_name}
Perfil: {profile} (VIP/Regular/etc)
Productos que compra: {current_products}
Productos sugeridos: {suggested_products}
Fuerza de la recomendacion: {co_purchase_rates}
```

### Metadata en predictions

```json
{
  "vertical_context": "cross_sell",
  "suggested_products": [
    {"product_id": "uuid", "name": "Protector Pantalla", "co_rate": 0.75},
    {"product_id": "uuid", "name": "Cable USB-C", "co_rate": 0.45}
  ],
  "factors": {
    "co_purchase_strength": 0.82,
    "customer_history": 0.70,
    "product_popularity": 0.65,
    "recency": 0.90
  }
}
```

---

## KPIs Avanzados

### 4 metricas nuevas

**1. Facturacion recurrente vs nueva (% y tendencia)**
- Calculo: `SUM(orders WHERE customer tiene 2+ compras) / SUM(all orders) * 100`
- Visualizacion: grafico linea mensual (6 meses) + numero con flecha tendencia
- Referencia IEY: 34% -> 74%

**2. Tasa de churn mensual**
- Calculo: `clientes_mes_anterior_sin_compra_este_mes / clientes_activos_mes_anterior * 100`
- Visualizacion: grafico linea mensual + color (verde <10%, amarillo 10-15%, rojo >15%)
- Referencia IEY: 18% -> 8%

**3. Ticket promedio**
- Calculo: `SUM(order_total) / COUNT(orders)`, separado recurrente vs nuevo
- Visualizacion: barras agrupadas mensuales + dos numeros

**4. Valor generado por PymePilot**
- Calculo: SUM order_total de predicciones con attribution.converted = true
- Visualizacion: barras mensuales + ROI (valor / costo Claude API)
- Fuente: metadata.attribution ya existe en predictions

### Pagina /metricas — Tab "Rendimiento"

```
+---------------------------------------------+
|  Metricas de Valor           [Exportar v]    |
+----------+----------+----------+-------------+
| Recur.   | Churn    | Ticket   | Valor       |
| 74%  ^3% | 8%   v2% | $45k     | $320k       |
+----------+----------+----------+-------------+
|                                              |
|  [Grafico: Facturacion mensual]              |
|  Lineas: recurrente / nueva / total          |
|  Ultimos 6 meses                             |
|                                              |
+----------------------+-----------------------+
| Churn mensual        | Ticket promedio        |
| [Grafico linea]      | [Grafico barras]       |
+----------------------+-----------------------+
| Valor generado por PymePilot                 |
| [Grafico barras] + ROI                       |
+----------------------------------------------+
```

### Queries SQL para KPIs

Todas calculadas desde tablas existentes (orders, customers, predictions).
No necesitan tablas nuevas. Se implementan como funciones en queries.py:

- `get_monthly_revenue_split(tenant_id, months=6)` — facturacion recurrente vs nueva
- `get_monthly_churn(tenant_id, months=6)` — tasa churn por mes
- `get_monthly_ticket(tenant_id, months=6)` — ticket promedio rec vs nuevo
- `get_monthly_value(tenant_id, months=6)` — valor atribuido a PymePilot

---

## Ranking de Clientes

### Pagina /metricas — Tab "Clientes"

Tabla ordenada por facturacion acumulada (mayor a menor):

| Columna | Fuente |
|---------|--------|
| Ranking | Calculado (RANK OVER) |
| Cliente | customers.name |
| Facturacion acumulada | SUM(orders.total) |
| Compras | COUNT(orders) |
| Ticket promedio | Facturacion / Compras |
| Ultima compra | MAX(orders.order_date) |
| Frecuencia | customers.avg_days_between_purchases |
| Top 3 productos | order_items agrupado por unidades |
| Tendencia | Ultimos 3 meses vs anteriores (^/=/v) |

### Detalle expandible por cliente

Al tocar un cliente se expande un panel con:
- Top 5 productos con unidades y facturacion
- Facturacion mensual (ultimos 4 meses)
- Frecuencia estimada y proxima compra
- Predicciones activas de cualquier vertical

### Vista materializada client_rankings

```sql
CREATE MATERIALIZED VIEW client_rankings AS
SELECT
    c.tenant_id,
    c.id AS customer_id,
    c.name,
    COUNT(o.id) AS total_orders,
    SUM(o.total) AS total_revenue,
    AVG(o.total) AS avg_ticket,
    MAX(o.order_date) AS last_purchase,
    c.avg_days_between_purchases,
    RANK() OVER (PARTITION BY c.tenant_id ORDER BY SUM(o.total) DESC) AS ranking
FROM customers c
JOIN orders o ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
GROUP BY c.tenant_id, c.id, c.name, c.avg_days_between_purchases;
```

Refresh diario con el orquestador (5 AM). Con 138 clientes IEY: ~2 segundos.

---

## Graficos — Recharts

4 componentes React con Recharts:

| Componente | Tipo | Series |
|------------|------|--------|
| RevenueChart | LineChart | 3 lineas (recurrente, nueva, total) |
| ChurnChart | LineChart | 1 linea + zonas color (verde/amarillo/rojo) |
| TicketChart | BarChart | 2 barras agrupadas (recurrente, nuevo) |
| ValueChart | BarChart | 1 barra + label ROI |

Mobile-first:
- Desktop: grid 2 columnas
- Celular: 1 columna, scroll vertical
- Tooltips con touch (tap en vez de hover)
- Ejes con formato abreviado ($45k)

---

## Reportes Exportables

### Excel (.xlsx) — libreria SheetJS

| Hoja | Contenido |
|------|-----------|
| Resumen | Periodo, KPIs principales, generado por PymePilot |
| Facturacion Mensual | Mes, Recurrente, Nueva, Total, % Recurrente |
| Predicciones | Cliente, Vertical, Fecha, Estado, Resultado |
| Clientes | Cliente, Compras, Ultima compra, Ticket promedio, Estado |

### PDF — libreria @react-pdf/renderer

Reporte de 1 pagina con:
- Header: PymePilot + tenant + periodo
- Resumen ejecutivo: 4 KPIs con comparacion mes anterior
- Top 10 clientes contactados con resultado
- Estadisticas de predicciones (generadas, contactadas, convertidas)
- Footer: generado por PymePilot

Sin graficos en PDF (complejidad alta, valor bajo). Para graficos: ver dashboard.

### Boton exportar

Dropdown en /metricas (tab Rendimiento):
```
[Exportar v]
  Descargar Excel (.xlsx)
  Descargar PDF
```

Todo client-side (se genera en el browser, sin backend).

---

## Migracion 026: Cross-Sell + KPIs

### Cambios SQL

```sql
-- 1. Vista materializada para co-compras (V3)
CREATE MATERIALIZED VIEW co_purchases AS
SELECT
    o.tenant_id,
    oi1.product_id AS product_a,
    oi2.product_id AS product_b,
    COUNT(DISTINCT oi1.order_id) AS times_bought_together,
    COUNT(DISTINCT oi1.order_id)::float /
        NULLIF((SELECT COUNT(DISTINCT o2.id)
                FROM orders o2
                JOIN order_items oi3 ON o2.id = oi3.order_id
                WHERE oi3.product_id = oi1.product_id
                AND o2.tenant_id = o.tenant_id), 0) AS co_purchase_rate
FROM order_items oi1
JOIN order_items oi2 ON oi1.order_id = oi2.order_id
    AND oi1.product_id < oi2.product_id
JOIN orders o ON oi1.order_id = o.id
GROUP BY o.tenant_id, oi1.product_id, oi2.product_id
HAVING COUNT(DISTINCT oi1.order_id) >= 3;

-- 2. Vista materializada para ranking de clientes
CREATE MATERIALIZED VIEW client_rankings AS
SELECT
    c.tenant_id,
    c.id AS customer_id,
    c.name,
    COUNT(o.id) AS total_orders,
    SUM(o.total) AS total_revenue,
    AVG(o.total) AS avg_ticket,
    MAX(o.order_date) AS last_purchase,
    c.avg_days_between_purchases,
    RANK() OVER (PARTITION BY c.tenant_id ORDER BY SUM(o.total) DESC) AS ranking
FROM customers c
JOIN orders o ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
GROUP BY c.tenant_id, c.id, c.name, c.avg_days_between_purchases;

-- 3. Indice para queries de KPIs mensuales
CREATE INDEX idx_orders_monthly_kpis
ON orders (tenant_id, order_date, customer_id);

-- 4. Indices en vistas materializadas
CREATE UNIQUE INDEX idx_co_purchases_pk
ON co_purchases (tenant_id, product_a, product_b);

CREATE UNIQUE INDEX idx_client_rankings_pk
ON client_rankings (tenant_id, customer_id);
```

### Rollback

```sql
DROP INDEX IF EXISTS idx_client_rankings_pk;
DROP INDEX IF EXISTS idx_co_purchases_pk;
DROP INDEX IF EXISTS idx_orders_monthly_kpis;
DROP MATERIALIZED VIEW IF EXISTS client_rankings;
DROP MATERIALIZED VIEW IF EXISTS co_purchases;
```

---

## Librerias nuevas (frontend)

| Libreria | Para que | Tamano aprox |
|----------|----------|--------------|
| recharts | Graficos interactivos | ~300kb |
| xlsx (SheetJS) | Exportar Excel | ~200kb |
| @react-pdf/renderer | Exportar PDF | ~400kb |

Todas client-side (browser). No necesitan backend.

---

## Archivos a crear (16)

### Backend (4)
| Archivo | Que hace |
|---------|----------|
| `backend/engine/verticales/cross_sell.py` | Clase VerticalCrossSell |
| `backend/config/prompts/cross_sell.txt` | Prompt para Claude |
| `database/migrations/026_cross_sell_kpis.sql` | Vistas materializadas + indices |
| `database/migrations/rollbacks/026_rollback.sql` | Rollback |

### Frontend — KPIs y graficos (7)
| Archivo | Que hace |
|---------|----------|
| `frontend/src/app/(dashboard)/metricas/page.tsx` | Pagina metricas (server component) |
| `frontend/src/app/(dashboard)/metricas/metricas-content.tsx` | Client component con graficos |
| `frontend/src/components/kpis/revenue-chart.tsx` | Grafico facturacion (Recharts) |
| `frontend/src/components/kpis/churn-chart.tsx` | Grafico churn |
| `frontend/src/components/kpis/ticket-chart.tsx` | Grafico ticket promedio |
| `frontend/src/components/kpis/value-chart.tsx` | Grafico valor PymePilot |
| `frontend/src/components/kpis/kpi-card.tsx` | Card reutilizable numero + tendencia |

### Frontend — Ranking clientes (4)
| Archivo | Que hace |
|---------|----------|
| `frontend/src/app/(dashboard)/metricas/clientes/page.tsx` | Tab "Clientes" (server component) |
| `frontend/src/components/kpis/client-ranking-table.tsx` | Tabla ranking expandible |
| `frontend/src/components/kpis/client-detail-panel.tsx` | Panel detalle expandido |
| `frontend/src/components/kpis/metrics-tabs.tsx` | Tabs Rendimiento / Clientes |

### Frontend — Exportar (3 archivos, pero ubicados en componentes existentes)
| Archivo | Que hace |
|---------|----------|
| `frontend/src/components/export/export-button.tsx` | Dropdown exportar |
| `frontend/src/lib/export-excel.ts` | Logica generacion Excel |
| `frontend/src/lib/export-pdf.tsx` | Logica generacion PDF |

**Total: 16 archivos nuevos**

## Archivos a modificar (4)

| Archivo | Cambio |
|---------|--------|
| `backend/engine/verticales/__init__.py` | Agregar `cross_sell` al VERTICAL_REGISTRY |
| `backend/engine/db/queries.py` | Agregar queries: cross_sell_candidates, monthly_kpis, refresh_views, client_rankings |
| `backend/main.py` | REFRESH MATERIALIZED VIEW al pipeline + check day_of_week para V3 |
| `frontend/src/components/layout/sidebar.tsx` | Agregar link a /metricas |

---

## Configuracion post-implementacion

```sql
-- Activar V3 para IEY
UPDATE tenants
SET active_verticals = '["reposicion","activacion","recuperacion","cross_sell"]'
WHERE slug = 'iey';
```

---

## Features futuras (NO incluidas en Fase 7)

1. Busqueda/filtro en ranking de clientes
2. Comparacion entre periodos en KPIs
3. Alertas automaticas cuando un KPI cruza umbral
4. Segmentacion de clientes (clustering)
5. Exportar ranking de clientes individual (ficha por cliente)
