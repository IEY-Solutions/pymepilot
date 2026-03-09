# Design Doc: Sistema de Followups Completo — Pipeline CRM

**Fecha:** 2026-03-09
**Estado:** Aprobado
**Scope:** Followups programados en todas las etapas del pipeline

---

## Problema

El pipeline actual solo tiene followups en "En seguimiento" con secuencias fijas.
El operador no entiende que va a pasar con cada lead, no recibe alertas, y las
etapas de cotizacion no tienen mecanismo de insistencia. El ciclo no se cierra
al vender (no se recalcula reposicion).

## Decisiones tomadas (brainstorming)

- Design doc completo, implementacion por partes
- Push in-app obligatorio + Notion/Google Calendar opcionales (fase futura)
- "Vendido" registra fecha, motor Python genera nueva oportunidad
- "En seguimiento" centraliza TODOS los seguimientos (de cualquier etapa)
- Badge de origen + secuencia diferenciada por etapa de origen
- Timers se evaluan al cargar el board (GET /api/pipeline), no cron
- Timers fijos: Contactado 2 dias, Por cotizar 1 dia, Cotizacion enviada 1 dia
- Badge compacto en card + plan completo en modal (todas las etapas activas)

---

## 1. Modelo de datos

### Cambios en tablas existentes

```sql
-- pipeline_cards: fecha limite de la etapa actual
ALTER TABLE pipeline_cards ADD COLUMN stage_deadline DATE;

-- predictions: proxima reposicion estimada (solo vertical reposicion)
ALTER TABLE predictions ADD COLUMN next_reposition_estimate DATE;
```

### Cambio en followups

```sql
-- origin_stage: desde que etapa se creo el followup
ALTER TABLE followups ADD COLUMN origin_stage TEXT
  CHECK (origin_stage IN ('contactado', 'por_cotizar', 'cotizacion_enviada'));
```

### Tabla nueva: followup_notifications

```sql
CREATE TABLE followup_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  followup_id UUID NOT NULL REFERENCES followups(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'notion', 'google_calendar')),
  external_id TEXT,          -- ID del evento/tarea en sistema externo
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE followup_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY followup_notifications_tenant_isolation ON followup_notifications
  USING (tenant_id = get_current_tenant_id());

-- Indices
CREATE INDEX idx_followup_notif_pending
  ON followup_notifications (tenant_id, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX idx_followup_notif_followup
  ON followup_notifications (followup_id);
```

### Tabla nueva: user_integrations (fase futura)

```sql
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('notion', 'google_calendar')),
  access_token TEXT NOT NULL,    -- encriptado
  refresh_token TEXT,            -- encriptado
  config JSONB DEFAULT '{}',     -- {database_id, calendar_id, etc.}
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
```

### Secuencias por origen

| Origen | Secuencia (dias) | Logica |
|--------|-----------------|--------|
| contactado | por vertical: [2,5,10] repo, [1,3,7] activ, [3,7,15] recup, [2,5,10] cross | Estandar |
| por_cotizar | [1, 3, 5] | Agresivo, cliente ya mostro interes |
| cotizacion_enviada | [2, 4, 7] | Insistir moderado |

### Timers por etapa (auto-mover a "En seguimiento")

| Etapa | Timer | Evaluacion |
|-------|-------|-----------|
| Contactado | 2 dias | GET /api/pipeline |
| Por cotizar | 1 dia | GET /api/pipeline |
| Cotizacion enviada | 1 dia | GET /api/pipeline |

---

## 2. Flujo de transiciones

```
A CONTACTAR
    |
    |-- (cualquier resultado) --> CONTACTADO [timer: 2 dias]
    |                               |
    |                               |-- (contesto) -> se queda + nota
    |                               |-- (pidio cotizacion) -> POR COTIZAR
    |                               |-- (timer vence / no contesto) -> EN SEGUIMIENTO [origin: contactado]
    |
    |-- (pidio cotizacion) --> POR COTIZAR [timer: 1 dia]

POR COTIZAR [timer: 1 dia]
    |-- (cotizacion enviada) -> COTIZACION ENVIADA
    |-- (contesto + nota) -> se queda
    |-- (no avanza / timer vence) -> EN SEGUIMIENTO [origin: por_cotizar]

EN SEGUIMIENTO [followups segun origin]
    |-- (contesto + pidio cotizacion) -> POR COTIZAR
    |-- (contesto + otro) -> CONTACTADO
    |-- (no contesto) -> se queda, sigue secuencia
    |-- (secuencia agotada) -> se queda, vendedor decide

COTIZACION ENVIADA [timer: 1 dia]
    |-- (vendido) -> VENDIDO
    |-- (rechazada + nota) -> se queda
    |-- (no avanza / timer vence) -> EN SEGUIMIENTO [origin: cotizacion_enviada]

VENDIDO
    |-- Registrar fecha venta + next_reposition_estimate
    |-- Motor Python genera nueva oportunidad cuando se acerque la fecha
```

Regla: al mover a "En seguimiento", siempre marcar followups previos como
skipped y crear nueva secuencia con el origin_stage correcto.

---

## 3. UX — Badges y modal

### Badge compacto en la card

Contactado:
  "Esperando respuesta — 1 dia restante"

En seguimiento:
  "Seguimiento 2/3 — manana (post-cotizacion)"

Por cotizar:
  "Esperando cotizacion — vence hoy"

Cotizacion enviada:
  "Esperando cierre — vence manana"

Timer vencido (cualquier etapa):
  "Sin respuesta — vencido hace 1 dia" (color naranja/rojo)

### Plan completo en el modal

Seccion "Plan de seguimiento" entre el banner de contexto y las acciones.
Muestra la secuencia completa con fechas concretas:

Ejemplo Contactado:
  * Contacto realizado (9/3)
  o Si no responde -> pasa a seguimiento (11/3)
    o Seguimiento 1 — 13/3
    o Seguimiento 2 — 16/3
    o Seguimiento 3 — 21/3

Ejemplo En seguimiento (origin: por_cotizar):
  * Pidio cotizacion (9/3) -> sin respuesta
  * Seguimiento 1 — completado (11/3): No contesto
  o Seguimiento 2 — manana (13/3)
  o Seguimiento 3 — 15/3

Pasos completados: bullet solido. Pendientes: bullet vacio.
Fechas concretas, no relativas.

### Consistencia

Las 4 etapas activas (Contactado, En seguimiento, Por cotizar,
Cotizacion enviada) usan el mismo patron: badge en card + plan en modal.

---

## 4. Notificaciones

### Push (implementar ahora)

Trigger: GET /api/pipeline detecta followups con scheduled_date = hoy
y sin notificacion enviada.

Contenido:
  "Hoy toca contactar a [Cliente] — Seguimiento 2/3 (post-cotizacion)"

Para timers vencidos:
  "[Cliente] lleva 2 dias sin respuesta en Por cotizar — movido a seguimiento"

Registra en followup_notifications: channel=push, status=sent.

### Notion (fase futura)

- OAuth desde perfil del vendedor
- Elige base de datos de Notion
- Al programar followups: crea tarea por cada uno
- Al completar: marca como "Hecho" en Notion
- Config en user_integrations: notion_access_token, notion_database_id

### Google Calendar (fase futura)

- OAuth desde perfil del vendedor
- Al programar followups: crea evento a las 9AM con recordatorio 30min
- Descripcion: copy del mensaje sugerido
- Al completar: elimina evento
- Config en user_integrations: google_calendar_token, google_calendar_id

---

## 5. Cierre del ciclo — Vendido

Cuando card llega a "Vendido":
1. Registrar completed_at = hoy (ya existe)
2. Si vertical === "reposicion":
   - Query: promedio dias entre ordenes del cliente
   - Si no hay historial: default 30 dias
   - Guardar next_reposition_estimate en prediction
3. Modal de "Vendido" muestra:
   - "Venta cerrada — 9 de marzo"
   - Si reposicion: "Proxima reposicion estimada: ~8 de abril (30 dias)"
   - "El motor de PymePilot generara una nueva oportunidad cuando se acerque la fecha."
4. Motor Python usa next_reposition_estimate para timing de nueva prediccion

Para otras verticales (activacion, cross-sell, recuperacion):
solo muestra "Venta cerrada — [fecha]".

---

## 6. Orden de implementacion

1. Migracion SQL (stage_deadline, origin_stage, followup_notifications, next_reposition_estimate)
2. Timers en GET /api/pipeline (auto-mover cards vencidas)
3. Badges compactos en pipeline-card.tsx (todas las etapas)
4. Plan de seguimiento en contact-modal.tsx
5. Logica de origin_stage en handleContact/handleMove
6. Secuencias diferenciadas por origen
7. Push notifications para followups del dia
8. Cierre del ciclo: vendido + next_reposition_estimate
9. (Futuro) Notion + Google Calendar integrations

## Fuera de scope

- Timer automatico configurable por tenant
- Followups manuales (el vendedor crea followups custom)
- Cancelacion individual de followups
- Implementacion de Notion y Google Calendar (solo diseño)
