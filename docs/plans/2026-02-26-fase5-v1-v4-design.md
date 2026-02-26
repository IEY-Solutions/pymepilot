# Fase 5: Verticales V1 (Activacion) y V4 (Recuperacion) — Design Doc

**Fecha:** 2026-02-26
**Estado:** Aprobado
**Prerequisito:** Fase 4 completada + auditada (0C/0H)

---

## Contexto

PymePilot tiene V2 Reposicion operativa (32 predicciones/dia para IEY).
Fase 5 agrega dos verticales mas para cubrir el ciclo de vida completo:

- **V1 Activacion:** Convertir clientes nuevos en recurrentes
- **V4 Recuperacion:** Reactivar clientes que dejaron de comprar

V3 Cross-Sell queda para Fase 7 (necesita mas datos de patrones cruzados).

---

## Decisiones de diseno (aprobadas por Pato)

| Decision | Resultado |
|----------|-----------|
| Secuencia V1 | Evaluacion diaria (no pre-generada). Motor revisa cada dia quien cae en ventana 7/15/25. |
| Recompra V1 | Si el cliente compra de nuevo, se "gradua" y sale de V1. La query lo excluye automaticamente (total_purchases_count > 1). |
| Cliente nuevo V1 | Debe ser genuinamente nuevo en la base: created_at reciente + exactamente 1 compra. No clientes viejos con 1 compra. |
| Ventanas V4 | Un mensaje por ventana (60/90/120 dias). 3 predicciones escalonadas con tono distinto. |
| Exclusion V2-V4 | Cliente con prediccion activa de V2 (pending/contacted) NO aparece como candidato de V4. |
| Confidence V1 | 3 factores: monto primera compra (40%), variedad productos (35%), dia secuencia (25%). |
| Confidence V4 | 4 factores: historial previo (30%), regularidad previa (25%), ventana inactividad (25%), antiguedad relacion (20%). |
| Prompts | 1 archivo .txt por vertical con contexto de ventana/dia. Claude adapta tono segun instrucciones del SYSTEM. |
| Dashboard | Vista unificada + chips de filtro por vertical. Badge con nombre de vertical + contexto (Dia 7, 90d, etc). |
| Arquitectura | Queries SQL directas (sin tabla de estado extra). Metadata en predictions guarda sequence_day / window_days. |

---

## V1 Activacion de Clientes Nuevos

### Logica de candidatos

Busca clientes que:
1. Tienen exactamente 1 compra (`total_purchases_count = 1`)
2. Son genuinamente nuevos (`created_at >= first_purchase_date - 7 days`)
3. Estan en ventana de secuencia: dia 7 (+/-1), dia 15 (+/-1), o dia 25 (+/-1) post primera compra
4. No tienen prediccion de activacion para ese paso especifico

```sql
-- Pseudoquery
SELECT c.*,
       (CURRENT_DATE - c.first_purchase_date) AS days_since_first,
       -- Determinar que dia de secuencia corresponde
       CASE
           WHEN (CURRENT_DATE - c.first_purchase_date) BETWEEN 6 AND 8 THEN 7
           WHEN (CURRENT_DATE - c.first_purchase_date) BETWEEN 14 AND 16 THEN 15
           WHEN (CURRENT_DATE - c.first_purchase_date) BETWEEN 24 AND 26 THEN 25
       END AS sequence_day
FROM customers c
WHERE c.tenant_id = %(tenant_id)s
  AND c.status = 'active'
  AND c.total_purchases_count = 1
  AND c.first_purchase_date IS NOT NULL
  AND c.created_at >= c.first_purchase_date - INTERVAL '7 days'
  AND (CURRENT_DATE - c.first_purchase_date) IN (6,7,8, 14,15,16, 24,25,26)
  AND NOT EXISTS (
      SELECT 1 FROM predictions p
      WHERE p.customer_id = c.id
        AND p.vertical = 'activacion'
        AND p.metadata->>'sequence_day' = <sequence_day>::text
        AND p.status IN ('pending', 'contacted', 'completed')
  )
```

Ventana +/-1 dia: cubre el caso de que el cron no corra un dia.

### Graduacion automatica

Si el cliente compra de nuevo (total_purchases_count pasa a 2), la query
deja de detectarlo automaticamente. No hay que cancelar nada — simplemente
desaparece del radar de V1 y aparece en V2 Reposicion cuando corresponda.

### Confidence score (3 factores)

| Factor | Peso | Logica |
|--------|------|--------|
| Monto primera compra | 40% | Normalizado contra ticket promedio del tenant. Ticket alto = mas comprometido. Escala: ratio ticket/promedio, cap en 1.0. |
| Variedad de productos | 35% | Cantidad de productos distintos en primera orden. 1 producto = 0.3, 2 = 0.5, 3 = 0.7, 4+ = 0.9. |
| Dia de secuencia | 25% | Dia 7 = 0.8 (fresco), Dia 15 = 0.5 (tibio), Dia 25 = 0.3 (frio). |

Rango esperado: 0.3 a 0.8.

### Prompt (activacion.txt)

```
===SYSTEM===
Asistente de ventas para {distributor_name}.
TAREA: Mensaje WhatsApp para cliente NUEVO (primera compra).

TONO SEGUN DIA:
- Dia 7: Follow-up calido. "Como te fue con el pedido?" Interes genuino.
- Dia 15: Sugerencia complementaria. Productos que complementan lo que compro.
- Dia 25: Propuesta de recompra. "Muchos clientes reponen en este momento."

REGLAS: Espanol argentino, max 5 oraciones + cierre, sin emojis/markdown.
Mencionar productos de forma natural (no como factura).

===USER===
DIA DE SECUENCIA: {sequence_day}
CLIENTE: {customer_name}
PRIMERA COMPRA: hace {days_since_first} dias ({first_purchase_date})
MONTO: ${first_order_amount}
PRODUCTOS QUE COMPRO:
{products_summary}
```

### Metadata guardada

```json
{
    "profile": "Nuevo",
    "sequence_day": 7,
    "days_since_first": 7,
    "confidence_factors": {
        "first_order_amount": 0.65,
        "product_variety": 0.50,
        "sequence_day": 0.80
    }
}
```

---

## V4 Recuperacion de Clientes Inactivos

### Logica de candidatos

Busca clientes que:
1. Tienen 2+ compras (`total_purchases_count >= 2`) — fueron recurrentes
2. Estan inactivos hace 60, 90, o 120 dias (+/-2)
3. No tienen prediccion activa de V2 Reposicion (evitar doble contacto)
4. No tienen prediccion de recuperacion para esa ventana especifica

```sql
-- Pseudoquery
SELECT c.*,
       (CURRENT_DATE - c.last_purchase_date) AS days_inactive,
       CASE
           WHEN (CURRENT_DATE - c.last_purchase_date) BETWEEN 58 AND 62 THEN 60
           WHEN (CURRENT_DATE - c.last_purchase_date) BETWEEN 88 AND 92 THEN 90
           WHEN (CURRENT_DATE - c.last_purchase_date) BETWEEN 118 AND 122 THEN 120
       END AS window_days
FROM customers c
WHERE c.tenant_id = %(tenant_id)s
  AND c.status = 'active'
  AND c.total_purchases_count >= 2
  AND (
      (CURRENT_DATE - c.last_purchase_date) BETWEEN 58 AND 62
      OR (CURRENT_DATE - c.last_purchase_date) BETWEEN 88 AND 92
      OR (CURRENT_DATE - c.last_purchase_date) BETWEEN 118 AND 122
  )
  -- Sin prediccion activa de V2 (evitar doble contacto)
  AND NOT EXISTS (
      SELECT 1 FROM predictions p
      WHERE p.customer_id = c.id
        AND p.vertical = 'reposicion'
        AND p.status IN ('pending', 'contacted')
  )
  -- Sin prediccion de recuperacion para esta ventana
  AND NOT EXISTS (
      SELECT 1 FROM predictions p
      WHERE p.customer_id = c.id
        AND p.vertical = 'recuperacion'
        AND p.metadata->>'window_days' = <window_days>::text
        AND p.status IN ('pending', 'contacted', 'completed')
  )
```

Ventana +/-2 dias: mas amplia que V1 porque inactivos no tienen urgencia al dia exacto.

### Confidence score (4 factores)

| Factor | Peso | Logica |
|--------|------|--------|
| Historial previo | 30% | Compras + monto combinados. min((count/10 + amount/avg_amount) / 2, 1.0). |
| Regularidad previa | 25% | Reutiliza logica de V2: CV = stddev/avg. CV bajo = regular = mas recuperable. |
| Ventana inactividad | 25% | 60 dias = 0.8 (todavia tibio), 90 dias = 0.5 (frio), 120 dias = 0.2 (casi perdido). |
| Antiguedad relacion | 20% | Reutiliza logica de V2: meses/12, cap en 1.0. Relacion larga = mas recuperable. |

Rango esperado: 0.2 a 0.9.

### Prompt (recuperacion.txt)

```
===SYSTEM===
Asistente de ventas para {distributor_name}.
TAREA: Mensaje WhatsApp para cliente que DEJO DE COMPRAR.

TONO SEGUN VENTANA:
- 60 dias: Recordatorio amigable. "Hacia rato que no hablabamos." Sin presion.
- 90 dias: Propuesta concreta. "Tenemos novedades que te pueden servir."
- 120 dias: Ultimo intento. "Queremos saber si hay algo que podamos mejorar."

REGLAS: Espanol argentino, max 5 oraciones + cierre, sin emojis/markdown.
Mencionar productos que solia comprar de forma natural.

===USER===
VENTANA: {window_days} dias sin comprar
PERFIL: {profile}
CLIENTE: {customer_name}
HISTORIAL: {total_purchases_count} pedidos por ${total_purchases_amount}
ULTIMA COMPRA: hace {days_inactive} dias ({last_purchase_date})
PRODUCTOS QUE SOLIA COMPRAR:
{products_summary}
```

### Metadata guardada

```json
{
    "profile": "VIP",
    "window_days": 90,
    "days_inactive": 91,
    "confidence_factors": {
        "purchase_history": 0.70,
        "regularity": 0.65,
        "inactivity_window": 0.50,
        "tenure": 0.80
    }
}
```

---

## Dashboard

### Vista unificada con filtro

La pagina Contactar muestra TODAS las predicciones del dia (V1+V2+V4)
ordenadas por prioridad. Chips de filtro arriba:

```
[Todas 12] [Repos. 6] [Activ. 3] [Recup. 3]
```

- Filtrado client-side (no recarga pagina)
- Chip activo resaltado, el resto gris
- Si una vertical tiene 0, chip grisado

### Badge de vertical en tarjeta

Cada prediction-card muestra un badge con:
- Color: azul (reposicion), verde (activacion), naranja (recuperacion)
- Texto: "Reposicion", "Activacion - Dia 7", "Recuperacion - 90d"
- Dato leido de `prediction.metadata.sequence_day` o `window_days`

### Sin cambios en

- Navegacion (sidebar/bottom-nav)
- Pagina KPIs (viene en Fase 7)
- Pagina Historial (ya filtra por vertical automaticamente)

---

## Archivos afectados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `backend/engine/verticales/activacion.py` | Nuevo | Clase VerticalActivacion |
| `backend/engine/verticales/recuperacion.py` | Nuevo | Clase VerticalRecuperacion |
| `backend/config/prompts/activacion.txt` | Nuevo | Prompt V1 |
| `backend/config/prompts/recuperacion.txt` | Nuevo | Prompt V4 |
| `backend/engine/verticales/__init__.py` | Modificar | 2 entradas en VERTICAL_REGISTRY |
| `backend/engine/db/queries.py` | Modificar | 2 queries nuevas |
| `frontend/src/app/(dashboard)/contactar/page.tsx` | Modificar | Chips de filtro |
| `frontend/src/components/predictions/prediction-card.tsx` | Modificar | Badge vertical |
| DB: `tenants.active_verticals` | UPDATE | Agregar 'activacion', 'recuperacion' para IEY |

**Total: 4 archivos nuevos, 5 modificados, 0 migraciones SQL, 0 tablas nuevas.**

---

## Seguridad

- Queries con `tenant_id` explicito (doble capa sobre RLS)
- Dedup con NOT EXISTS + indice UNIQUE existente
- Prompts no incluyen datos sensibles (no API keys, no credenciales)
- Metadata no contiene PII adicional a lo que ya esta en customers
- Exclusion V2-V4 evita spam al mismo cliente
- Sin escritura al ERP (solo lectura, regla #1 de CLAUDE.md)
