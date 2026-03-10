# Design Doc — Backlog Features Fase 10 (3 features)

**Fecha:** 2026-03-10
**Estado:** Aprobado por Pato
**Origen:** Notion "Features PymePilot — Backlog de mejoras"

---

## Contexto

Tres features del backlog de Notion priorizadas por Pato. Se implementan
en orden secuencial por dependencias de navegacion.

Excluida: Sync stock (bloqueada por ticket Contabilium).

---

## Feature 1: Reestructurar Secciones

### Decision
Pipeline absorbe todo. Se eliminan `/contactar` y `/historial`.

### Cambios

1. **Predicciones directas al Pipeline:** El motor Python genera predicciones
   que se crean directamente como `pipeline_cards` en la columna "A contactar".
   Se elimina el paso intermedio de `predictions` → sync → `pipeline_cards`.

2. **Mensaje editable en modal:** Al abrir una card en "A contactar", el modal
   muestra el mensaje de Claude en un textarea editable. El vendedor lo ajusta
   si quiere y usa el boton WhatsApp (copiar + abrir wa.me).

3. **Navegacion reducida (8 → 6):**
   - Eliminar: Contactar, Historial
   - Quedan: Inicio, Pipeline, Metricas, Mis Ventas, Datos, Asesor IA

4. **Codigo a eliminar:**
   - `frontend/src/app/(dashboard)/contactar/` (page + content)
   - `frontend/src/app/(dashboard)/historial/` (page + content)
   - Componentes `predictions/` que queden sin uso
   - RPC `sync_predictions_to_pipeline` (si ya no se necesita como paso separado)

5. **Pipeline sin cambios funcionales:** Las 6 columnas, drag & drop, followups,
   notas, timers, stage_messages — todo sigue igual.

### Lo que NO cambia
- Motor Python sigue generando predicciones (cambia donde se materializan)
- Chatbot, metricas, datos, logros — sin cambios
- `/historial` se elimina (Pato decidio que no lo necesita)

---

## Feature 2: Personalizacion + Mejora Visual

### Decision
Logo del cliente + 1 color primario + "Powered by PymePilot" en footer.

### Cambios

1. **Paleta PymePilot:** Extraer colores del sitio web de Pato (URL pendiente).
   Aplicar como diseno base global con iconos modernos.

2. **Branding por tenant:**
   - El cliente sube su logo (storage)
   - El cliente elige UN color primario
   - CSS variables dinamicas aplican ese color a header, botones, acentos
   - El resto del diseno es PymePilot para todos

3. **"Powered by PymePilot"** en el footer de todas las paginas.
   La marca PymePilot nunca desaparece.

4. **Nueva pagina `/configuracion`:**
   - Upload de logo
   - Selector de color primario
   - Escalable a futuro (moneda, zona horaria, preferencias)

5. **Navegacion (6 → 7):** Se agrega Configuracion.

### Almacenamiento
- Campo `branding_config` JSONB en tabla `tenants`:
  ```json
  {
    "logo_url": "https://...",
    "primary_color": "#3B82F6"
  }
  ```
- Logo en Supabase Storage (bucket por tenant)

### Implementacion tecnica
- React Context para theme (BrandingProvider)
- CSS custom properties (`--color-primary`, etc.)
- Componentes usan variables en vez de colores hardcodeados

---

## Feature 3: Proyeccion de Stock (Fase 1 — Demanda)

### Decision
Construir vista de demanda proyectada con datos existentes. Stock actual
se suma cuando se resuelva ticket Contabilium.

### Dos vistas

**Vista Global (por SKU):**
- Tabla de productos con demanda estimada agregada
- Columnas: Producto, Demanda proximas 2 semanas (unidades), Clientes que
  lo compran, Frecuencia promedio, Confianza del estimado
- Ordenado por demanda (mas demandados arriba)

**Vista Top 20 Clientes (detallada):**
- Los 20 clientes mas importantes del canal
- Por cada cliente: que productos va a necesitar, cuantas unidades,
  cuando (basado en frecuencia e historial), ultima compra
- Permite ver "Juan va a pedir 30 fundas, Maria 25, Pedro 20..."
- Valor: prepararse proactivamente y contactar antes de que pidan

### Datos disponibles (ya existen en DB)
- `order_items.quantity` — unidades por pedido
- `avg_days_between_orders` — frecuencia por SKU por cliente (query LAG existente)
- `predicted_reorder_date` — fecha estimada proxima compra
- `avg_quantity` — promedio unidades por pedido
- `client_rankings_secure` — ranking de clientes por revenue

### Score de confianza (por SKU)
1. Regularidad de consumo (CV de cantidad por pedido)
2. Cantidad de datos (ciclos de compra historicos)
3. Recencia (que tan fresco es el dato)
4. Tendencia (cantidad creciente/decreciente)
5. Estabilidad de demanda (variacion entre clientes)

### Pagina `/proyeccion`
- Tab o toggle: Vista Global | Top 20 Clientes
- Filtros: periodo de proyeccion (2 semanas, 1 mes, 2 meses)
- Export a Excel (como metricas)

### Navegacion (7 → 8)
Se agrega Proyeccion. Mismo numero que la navegacion original.

### Fase 2 (futura, post-Contabilium)
- Stock actual por SKU
- Dias hasta quiebre de stock
- Punto de reorden
- Stock de seguridad
- Alertas de quiebre inminente

---

## Orden de implementacion

| # | Feature | Items nav | Depende de |
|---|---------|-----------|------------|
| 1 | Reestructurar secciones | 8 → 6 | — |
| 2 | Personalizacion + Visual | 6 → 7 | URL web Pato (paleta) |
| 3 | Proyeccion de stock | 7 → 8 | — |

Feature 1 va primero porque cambia la navegacion base.
Feature 2 necesita la URL del sitio web para extraer la paleta.
Feature 3 es independiente.

---

## Decisiones de brainstorming documentadas

| Pregunta | Opciones | Elegida | Razon |
|----------|----------|---------|-------|
| Prioridad | A-B-C | A-C-B | Valor para IEY |
| Como fusionar Contactar | Pipeline absorbe vs vista filtrada | Pipeline absorbe | Un solo flujo |
| Edicion mensaje | Inline vs modal vs popup | Modal | Ya existe, consistente |
| Atajo "hoy" | Sin atajo vs filtro | Sin atajo | YAGNI, columna A contactar basta |
| Historial | Mantener vs eliminar | Eliminar | No lo necesita |
| Nivel personalizacion | Solo logo vs logo+color vs paleta completa | Logo + 1 color | Balance |
| Marca PymePilot | Header vs footer vs ambos | Footer "Powered by" | Patron SaaS estandar |
| Donde configurar | En /datos vs nueva /configuracion | Nueva pagina | Escalable |
| Proyeccion donde | Tab en metricas vs pagina nueva | Pagina nueva | Va a crecer |
| Demanda ahora o esperar stock | Ahora vs esperar | Ahora | 60% datos disponibles |
| Vista top clientes | Solo global vs global + top 20 | Ambas | Detalle por cliente |
