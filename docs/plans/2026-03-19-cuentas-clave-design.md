# Design Doc: Sección "Cuentas Clave"

**Fecha:** 2026-03-19
**Estado:** Aprobado
**Autor:** Pato + Claude Code (brainstorming colaborativo)

---

## Resumen

Nueva sección independiente en el dashboard de PymePilot para gestión de
clientes estratégicos (Key Account Management). Pensada para 6-15 cuentas
clave por operador, con seguimiento relacional (no operativo).

**Diferencia con Pipeline CRM:** Pipeline es operativo (contactar → vender).
Cuentas Clave es relacional (seguimiento, relación, historial, promesas).

---

## Decisiones de diseño

| Decisión | Elección | Alternativas descartadas |
|----------|----------|--------------------------|
| Arquitectura | Sección independiente (`/cuentas-clave`) con tablas propias | Extensión del Pipeline / Tablas genéricas compartidas |
| Designación de clientes | Sugerido por sistema + manual por operador | Solo manual / Solo automático |
| Vista principal | Tarjetas con semáforo (sin dashboard resumen) | Dashboard arriba + lista / Timeline de tareas |
| Alertas | 3 tipos combinados: temporal + comportamiento + manual | Solo manuales / Solo automáticas |
| Notas | Estructuradas con tipo + action items → recordatorios | Texto libre sin estructura / Estructura completa con adjuntos |
| Nudge de seguimiento | Sugerencia proactiva 15/20 días al cerrar nota o completar acción | Sin nudge / Obligatorio |

---

## Modelo de datos

### Tabla `key_accounts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador único |
| tenant_id | UUID FK → tenants | Aislamiento multi-tenant |
| customer_id | UUID FK → customers | Cliente existente marcado como clave |
| status | TEXT | `active` / `archived` |
| health_score | TEXT | `green` / `yellow` / `red` (automático) |
| health_override | TEXT NULL | Override manual del operador (anula automático) |
| source | TEXT | `manual` / `suggested` |
| notes_count | INT DEFAULT 0 | Contador para tarjeta |
| pending_actions_count | INT DEFAULT 0 | Contador para tarjeta |
| created_at | TIMESTAMPTZ | Cuándo se marcó como cuenta clave |
| created_by | UUID FK → auth.users | Quién lo marcó |

- RLS habilitado con tenant_id
- UNIQUE(tenant_id, customer_id) — un cliente solo puede ser cuenta clave una vez

### Tabla `key_account_notes`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador único |
| tenant_id | UUID FK → tenants | Aislamiento multi-tenant |
| key_account_id | UUID FK → key_accounts | A qué cuenta pertenece |
| note_type | TEXT | `meeting` / `call` / `promise` / `observation` |
| content | TEXT | Texto libre de la nota |
| created_by | UUID FK → auth.users | Autor |
| created_at | TIMESTAMPTZ | Fecha automática |

- RLS habilitado con tenant_id

### Tabla `key_account_alerts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID PK | Identificador único |
| tenant_id | UUID FK → tenants | Aislamiento multi-tenant |
| key_account_id | UUID FK → key_accounts | A qué cuenta pertenece |
| alert_type | TEXT | `temporal` / `behavioral` / `manual` |
| title | TEXT | Título corto |
| description | TEXT NULL | Detalle opcional |
| trigger_rule | TEXT NULL | Para automáticas: regla (ej: `no_purchase_days > 30`) |
| trigger_date | TIMESTAMPTZ NULL | Para manuales/temporales: cuándo dispararla |
| status | TEXT | `pending` / `triggered` / `dismissed` / `resolved` |
| source_note_id | UUID FK → key_account_notes NULL | Si fue creada desde una nota |
| created_at | TIMESTAMPTZ | Cuándo se creó |
| resolved_at | TIMESTAMPTZ NULL | Cuándo se resolvió |

- RLS habilitado con tenant_id
- Acciones pendientes de notas = alertas tipo `manual` con `source_note_id`

---

## Vista principal: `/cuentas-clave`

### Grilla de tarjetas

Cada tarjeta muestra:
- Semáforo de salud (círculo de color)
- Nombre del cliente
- Dato clave (PDV, rubro)
- Facturación mensual + tendencia (% vs mes anterior)
- Última interacción (fecha de última nota)
- Contadores: alertas activas + acciones pendientes
- Indicador "Sin seguimiento programado" si no hay alertas futuras

### Ordenamiento
1. Rojos primero
2. Luego amarillos
3. Luego verdes
4. Dentro de cada color: última interacción más antigua primero

### Lógica del semáforo automático

| Color | Regla |
|-------|-------|
| 🟢 Verde | Compró en últimos 30 días + sin alertas urgentes + sin acciones vencidas |
| 🟡 Amarillo | No compró en 30-60 días, O acciones vencidas, O bajó facturación >20% |
| 🔴 Rojo | No compró en 60+ días, O bajó facturación >40%, O alertas críticas sin resolver |

- Override manual: el operador puede forzar un color con justificación
- El override se mantiene hasta que el operador lo libere

### Botón "Agregar cuenta clave"
- Abre buscador de clientes existentes (desde `customers`)
- Muestra sugerencias del sistema (clientes que superan umbral de facturación/PDV)
- El operador confirma o rechaza cada sugerencia

---

## Perfil detallado (click en tarjeta)

### Layout — 7 bloques

| # | Bloque | Posición | Fuente de datos |
|---|--------|----------|-----------------|
| 1 | Datos generales | Arriba izquierda | `customers` |
| 2 | Resumen financiero | Arriba derecha | `orders` + `order_items` (calculado) |
| 3 | Semáforo de salud | Header, al lado del nombre | `key_accounts.health_score` / `health_override` |
| 4 | Alertas activas | Medio izquierda | `key_account_alerts` WHERE status IN (pending, triggered) |
| 5 | Acciones pendientes | Medio derecha | `key_account_alerts` WHERE alert_type = manual AND source_note_id IS NOT NULL |
| 6 | Productos clave | Franja completa | `order_items` + `products` (top por facturación) |
| 7 | Timeline de interacciones | Abajo, franja completa | `key_account_notes` ORDER BY created_at DESC |

### Mobile
Bloques apilados verticalmente en una columna, scrolleable.

---

## Crear nota (formulario)

1. **Tipo** — Select: Reunión / Llamada / Promesa / Observación
2. **Texto** — Campo libre
3. **Acciones** — Botón "Agregar acción" (0 o más):
   - Título de la acción
   - Fecha de vencimiento
   - Se crea como alerta tipo `manual` con `source_note_id`

---

## Nudge de seguimiento

### Trigger
Aparece cuando el operador guarda una nota o completa una acción, Y no existe
ninguna alerta futura (trigger_date > now) para esa cuenta clave.

### UI
Banner con opciones rápidas:
- **En 15 días** (1 click)
- **En 20 días** (1 click)
- **Otra fecha** (abre date picker)
- **Ahora no** (cierra, vuelve a aparecer en próxima interacción)

### Indicador en tarjeta
Si una cuenta no tiene seguimiento futuro, mostrar en la tarjeta:
"⚠ Sin seguimiento programado"

---

## Sistema de alertas — 3 tipos

### Temporales (automáticas)
- "Hace X días que no interactuás con este cliente"
- Evaluadas diariamente contra última nota

### Por comportamiento (automáticas)
- "Bajó X% su facturación vs mes anterior"
- "Dejó de pedir producto Y"
- "No compra hace X días"
- Evaluadas en el motor diario (5 AM) o al abrir la sección

### Manuales (operador)
- Creadas desde notas (action items) o desde botón "Nueva alarma"
- Tienen fecha de vencimiento
- Se disparan cuando llega la fecha

---

## Sugerencias del sistema

### Criterios para sugerir un cliente como cuenta clave
- Facturación mensual > percentil 90 del tenant
- Cantidad de PDV elevada (si el dato existe)
- Frecuencia de compra alta + ticket promedio alto

### Flujo
1. El sistema calcula periódicamente qué clientes cumplen criterios
2. Al hacer click en "Agregar cuenta clave", se muestran como sugerencias
3. El operador acepta (se crea key_account con source=suggested) o rechaza

---

## Navegación

- Nueva ruta: `/cuentas-clave`
- Nuevo item en sidebar + bottom-nav: icono Star o Shield, label "Cuentas Clave"
- Posición: después de Pipeline, antes de Métricas (segundo o tercer lugar)
