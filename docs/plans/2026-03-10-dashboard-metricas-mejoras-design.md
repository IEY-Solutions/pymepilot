# Design Doc: Mejoras Dashboard Metricas

**Fecha:** 2026-03-10
**Estado:** Aprobado
**Scope:** 3 mejoras al dashboard /metricas existente

---

## Problema

El dashboard de metricas actual muestra KPIs y graficos del mes actual con
tendencia vs mes anterior, pero no permite comparar periodos largos ni ver
el crecimiento en distintos plazos. No hay visibilidad de productos mas
vendidos a nivel global, y el detalle por cliente solo muestra top 5
productos sin opcion de ordenar por unidades.

## Mejoras aprobadas

### 1. Pestana "Comparar" (nueva)

Tercer tab en /metricas, al mismo nivel que "Rendimiento" y "Clientes".

**Selector de periodo** con 2 controles:
- Tipo de comparacion: Mes vs anterior | Trimestre vs anterior | Periodo custom
- Rango: Ultimos 4 meses | 6 meses | 9 meses | Ultimo ano

**KPIs comparativos** — Tabla con 5 metricas (ventas, % recurrente, churn,
ticket promedio, valor PymePilot) mostrando periodo actual, periodo anterior,
y variacion con color (verde=mejoro, rojo=empeoro, inverso para churn).

**Graficos con overlay** — Los mismos 4 graficos (facturacion, churn, ticket,
valor) con el periodo anterior superpuesto: linea punteada para periodo
anterior, linea solida para actual. Barras semi-transparentes para BarCharts.

**Datos:** Reutiliza las RPCs existentes pidiendo mas meses para cubrir ambos
periodos. No requiere RPCs nuevas.

### 2. Pestana "Productos" (nueva)

Cuarto tab en /metricas.

**Toggle:** Ordenar por monto facturado | Ordenar por unidades vendidas

**Tabla de ranking:**
- Posicion (#)
- Producto (nombre + SKU)
- Unidades vendidas
- Monto facturado
- Barra visual proporcional al maximo

Se muestran todos los productos con ventas, ordenados segun el toggle activo.
El valor no seleccionado se muestra como columna secundaria en gris.
Se actualiza en cada carga (datos en tiempo real desde la DB).

**Datos:** RPC nueva `get_product_rankings()`.

### 3. Top 10 productos por cliente (mejora existente)

Panel expandible en tab "Clientes" — cambios:
- TOP 5 → TOP 10
- Toggle: "Por monto facturado" | "Por unidades vendidas"
- Cada fila: SKU, nombre, unidades, monto
- Orden cambia segun toggle (client-side, datos ya vienen con ambos valores)

**Datos:** Modificar RPC `get_client_top_products` para devolver 10 + unidades.

---

## Modelo de datos

### RPC nueva: get_product_rankings

```sql
CREATE OR REPLACE FUNCTION public.get_product_rankings()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_sku text,
  total_units bigint,
  total_revenue numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    COALESCE(p.sku, '') AS product_sku,
    SUM(oi.quantity)::bigint AS total_units,
    SUM(oi.total_price) AS total_revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.tenant_id = get_current_tenant_id()
    AND o.status = 'completed'
  GROUP BY p.id, p.name, p.sku
  ORDER BY total_revenue DESC;
$$;
```

### Modificacion: get_client_top_products

Cambiar LIMIT 5 → LIMIT 10, agregar SUM(oi.quantity) AS total_units al SELECT.

---

## UX

### Tabs en /metricas

Rendimiento | Clientes | Comparar | Productos

### Pestana Comparar

```
[Mes vs anterior ▼]  [Ultimos 6 meses ▼]

┌─────────────┬──────────┬──────────┬───────────┐
│ Metrica     │ Actual   │ Anterior │ Variacion │
├─────────────┼──────────┼──────────┼───────────┤
│ Ventas      │ $1.2M    │ $980K    │ +22% ↑    │
│ % Recurrent │ 74%      │ 68%     │ +6pp      │
│ Churn       │ 8%       │ 11%     │ -3pp ↓    │
│ Ticket prom │ $45K     │ $42K    │ +7%       │
│ Valor PP    │ $280K    │ $195K   │ +44%      │
└─────────────┴──────────┴──────────┴───────────┘

[Graficos con overlay: linea solida = actual, punteada = anterior]
```

### Pestana Productos

```
[Por monto facturado ● | ○ Por unidades vendidas]

# │ Producto                        │ Unidades │ Monto      │ ▓▓▓▓▓▓▓▓
1 │ MagSafe Case iPhone 15 (SKU-01) │ 342      │ $1.250.000 │ ████████████
2 │ Cargador MagSafe (SKU-45)       │ 281      │ $980.000   │ █████████
3 │ ...                             │          │            │
```

### Top 10 por cliente (panel expandible)

```
[Por monto ● | ○ Por unidades]

Producto                  │ Unidades │ Monto
MagSafe Case iPhone 15    │ 45       │ $162.000
Cargador MagSafe          │ 38       │ $133.000
... (hasta 10)
```

---

## Orden de implementacion

1. Migracion SQL: RPC nueva get_product_rankings + modificar get_client_top_products
2. Pestana Productos (mas simple, independiente)
3. Top 10 por cliente (modificacion menor)
4. Pestana Comparar (la mas compleja, reutiliza RPCs existentes)

## Fuera de scope

- Filtro por rango de fechas custom con date picker
- Exportacion de la pestana Comparar a Excel/PDF
- Graficos de productos (sparklines de tendencia por producto)
- Comparacion de productos entre periodos
