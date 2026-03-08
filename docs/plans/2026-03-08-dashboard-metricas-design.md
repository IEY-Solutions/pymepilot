# Dashboard / Metricas — 3 features de mejora

**Fecha:** 2026-03-08
**Estado:** Aprobado
**Prioridad:** Media (Grupo A — tercera prioridad del backlog)

---

## Feature A1: Ranking de productos mas vendidos

### Que es
Tabla expandible en /metricas con los productos mas vendidos,
similar al ranking de clientes que ya existe.

### Columnas
- Producto (nombre)
- Unidades vendidas
- Monto facturado
- Cantidad de clientes que lo compran

### Funcionalidad
- Filtro de periodo: mensual / historico
- Ordenable por cualquier columna (click en header)
- Expandible: top 20 por default, expandir para ver mas

### Ubicacion
Debajo del ranking de clientes existente en /metricas,
o en tabs (Clientes | Productos) para no hacer la pagina
demasiado larga.

---

## Feature A2: Top 10 productos por cliente

### Que es
Al hacer click en un cliente del ranking en /metricas,
se expande y muestra sus top 10 productos personales.

### Funcionalidad
- Se integra en el ranking de clientes existente
- Click en fila de cliente -> se expande con detalle
- Top 10 productos de ese cliente
- Toggle para ordenar por: unidades vendidas | monto facturado
- Misma mecanica expandible que ya tiene el ranking

### Datos por producto
- Nombre producto
- Unidades compradas (por ese cliente)
- Monto total (por ese cliente)
- Ultima vez que lo compro

---

## Feature A3: Comparar dashboard vs periodos anteriores

### Que es
Selector de periodo en la parte superior de /metricas que permite
comparar todos los KPIs y graficos contra un mes anterior.

### Selector
- Dropdown "Comparar con:" arriba de /metricas
- Opciones: mes anterior, hace 2 meses, hace 3 meses, mismo mes ano anterior
- Default: sin comparacion (solo datos actuales)

### KPIs con delta
Cada KPI muestra el valor actual + delta vs periodo seleccionado:
- "$1.2M ↑15% vs febrero" (verde = sube, positivo)
- "8.2% ↓2pp vs febrero" (verde = baja churn, positivo)
- Flechas y colores contextuales (para churn, bajar es bueno)

### Graficos superpuestos
- Linea solida = periodo actual
- Linea punteada = periodo de comparacion
- Leyenda clara con ambos periodos

---

## Archivos impactados

### Frontend (ediciones)
- frontend/src/app/(dashboard)/metricas/ — selector comparacion, ranking productos
- frontend/src/components/ — componente ranking productos, expansion cliente top 10
- frontend/src/app/(dashboard)/metricas/charts/ — superponer periodos en graficos

### Backend
- 3-4 queries SQL nuevas (RPCs):
  - top_productos_global(tenant_id, periodo_inicio, periodo_fin, orden, limit)
  - top_productos_cliente(tenant_id, customer_id, orden, limit)
  - metricas_periodo(tenant_id, periodo_inicio, periodo_fin) — para comparacion

### Database
- database/migrations/042_product_ranking_rpc.sql — RPCs nuevas
