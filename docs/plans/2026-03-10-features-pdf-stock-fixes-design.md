# Design Doc — Features PDF, Proyeccion de Demanda y Fixes

**Fecha:** 2026-03-10
**Estado:** Aprobado
**Origen:** Notion "Features PymePilot — Backlog de mejoras"

---

## Scope

3 features del backlog:
- Feature 2: Reportes PDF completos con identidad PymePilot
- Feature 3: Proyeccion de demanda (stock)
- Feature 4: Arreglar detalles (periodos custom, expiracion, chatbot)

Feature 1 (sync stock desde ERP) queda bloqueada por ticket Contabilium.

---

## Feature 4 — Arreglar detalles

### 4A. Fix periodos custom en metricas

**Archivo:** `frontend/src/app/(dashboard)/metricas/metricas-content.tsx`

**Problema:** Los botones [4m, 6m, 9m, 12m] existen en la UI pero el codigo
ignora `compareRange` — siempre divide los datos en 2 mitades iguales.

**Solucion:** Modificar el `useMemo` de comparacion para que cuando
`compareType === "custom"`, use `compareRange` seleccionado:
- Ultimos N meses = `revenue.slice(-compareRange)`
- N meses anteriores = `revenue.slice(-compareRange * 2, -compareRange)`
- Si no hay datos suficientes, mostrar lo disponible
- Labels: "Ultimos Xm" vs "Xm anteriores"

### 4B. Eliminar expiracion de predicciones

**Problema:** Cards se atenuan + predicciones >30 dias no se sincronizan.

**Solucion:**
- MANTENER atenuacion visual (opacity 60%) como senal informativa
- ELIMINAR filtro de 30 dias en sincronizacion al pipeline
- ELIMINAR cualquier logica que marque predicciones como `expired` automaticamente
- El operador decide cuando descartar. El sistema solo avisa visualmente.

**Archivos a modificar:**
- `frontend/src/app/api/pipeline/route.ts` — remover filtro fecha en sync
- Verificar RPC `sync_predictions_to_pipeline` si existe filtro SQL

### 4C. Auto-move de timers

**Hallazgo:** El codigo esta BIEN implementado. Las cards SI se mueven
automaticamente cuando vence `stage_deadline`. El chatbot dio info incorrecta.

**Accion:** Actualizar base de conocimiento del chatbot (`asesor_chat.txt`)
cuando se completen todas las features.

---

## Feature 2 — Reportes PDF completos

### Archivo principal
`frontend/src/app/(dashboard)/metricas/exports/export-pdf.tsx`

### Identidad visual
- Header: Fondo dark (`#1a2a2c`) con texto blanco, nombre PymePilot en teal (`#81b5a1`)
- Acentos: Bordes y separadores en teal (`#5a9a84`)
- Tablas: Headers con fondo teal, filas alternadas con tono sutil
- Footer: Barra teal con "Generado por PymePilot — pymepilot.cloud"
- Estetica dark/profesional coherente con el dashboard

### Secciones del PDF (8 secciones)

| # | Seccion | Contenido |
|---|---------|-----------|
| 1 | Header ejecutivo | Periodo seleccionado + fecha generacion |
| 2 | KPIs principales | Recurrencia, Churn, Ticket promedio, Valor PymePilot |
| 3 | Comparacion de periodos | Periodo actual vs anterior con % de cambio |
| 4 | Facturacion mensual | Tabla desglose por mes (total, recurrente, nueva, %) |
| 5 | Churn mensual | Tabla con activos, churned, % churn por mes |
| 6 | Ranking productos | Top productos mas vendidos |
| 7 | Proyeccion de demanda | Top 15 productos con demanda proyectada (Feature 3) |
| 8 | Top 10 clientes | Ranking, facturacion, compras, ticket, ultima compra |
| 9 | Footer | Branding PymePilot |

### Periodo dinamico
El PDF refleja exactamente lo que el usuario esta viendo en pantalla.
Si selecciono "Ultimos 4 meses vs anteriores", el reporte muestra esos datos.

### Enfoque tecnico
Usar `@react-pdf/renderer` (ya instalado). Todas las secciones como tablas
(no graficos). Resultado profesional tipo reporte ejecutivo.

---

## Feature 3 — Proyeccion de Demanda

### Objetivo de negocio
El dueno responde: "Cuantas unidades de cada producto necesito para el
proximo mes para no fallarle a mis clientes mas importantes?"

### Vista Global — nueva seccion en /metricas

**KPI destacado:**
> "Demanda proyectada prox 30 dias: X unidades en Y productos de Z clientes activos"

**Tabla Top 15 productos por demanda proyectada:**

| Col | Descripcion |
|-----|-------------|
| # | Ranking por demanda |
| Producto | Nombre del SKU |
| Demanda prox. 30d | Unidades estimadas para el proximo mes |
| Unids/mes (prom) | Promedio historico mensual |
| Tendencia | % cambio vs promedio (sube/baja) |
| Clientes que lo piden | Cantidad de clientes unicos |
| Top cliente | Quien concentra la mayor demanda |

### Vista Individual — expandible por producto

Al hacer click en un producto, desglose por cliente:

| Col | Descripcion |
|-----|-------------|
| Cliente | Nombre |
| Ult. compra | Fecha ultimo pedido |
| Qty ultima | Unidades del ultimo pedido |
| Qty promedio | Promedio historico de unidades |
| Cada cuanto | Frecuencia promedio entre pedidos |
| Prox. compra est. | Fecha estimada siguiente compra |
| Demanda est. | Unidades estimadas |

### Calculo (backend o frontend)

**Logica de proyeccion:**
1. Agrupar `order_items` por producto y cliente
2. Calcular frecuencia: diferencia promedio entre fechas de compra por cliente
3. Calcular cantidad estimada: promedio ponderado (ultimas compras pesan mas)
4. Proyeccion: ultimo pedido + frecuencia = fecha estimada proxima compra
5. Si fecha estimada cae dentro de proximos 30 dias, sumar a demanda proyectada
6. Tendencia: comparar demanda ultimos 3 meses vs 3 meses anteriores

**Sin tabla nueva en DB** — se calcula on-the-fly desde `orders` + `order_items`.

### Incluido en PDF
Seccion "Proyeccion de Demanda" con KPI total + tabla top 15 productos.
Sin desglose por cliente (mantener PDF ejecutivo).

---

## Orden de implementacion sugerido

1. Feature 4A — Fix periodos custom (rapido, desbloquea PDF)
2. Feature 4B — Eliminar expiracion (rapido)
3. Feature 3 — Proyeccion de demanda (nuevo, mas complejo)
4. Feature 2 — PDF completo (depende de 3 y 4A para tener todos los datos)
5. Feature 4C — Actualizar chatbot (al final, cuando todo este listo)

---

## Decisiones clave

- **PDF con tablas, no graficos** — mas confiable y profesional para papel
- **Expiracion visual SI, eliminacion NUNCA** — operador tiene control total
- **Proyeccion sin tabla nueva en DB** — calculo on-the-fly desde datos existentes
- **Periodo PDF = periodo en pantalla** — coherencia entre dashboard y reporte
