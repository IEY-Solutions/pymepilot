# Fase 10 Bloque C — Mejoras UX Dashboard

**Fecha:** 2026-03-06
**Estado:** Aprobado
**Prerequisitos:** Bloque B completado (atribucion multi-vertical + ventana 30 dias)

---

## Contexto

El dashboard es funcional pero incompleto. El vendedor puede ver predicciones,
contactar via WhatsApp, y marcar como contactado/ignorado. Pero no ve el
resultado de su gestion (si la venta se concreto), no recibe recordatorios,
y no puede priorizar eficientemente su lista de contactos.

WhatsApp Cloud API fue eliminado del plan. El dashboard es el canal unico.

---

## Features (orden de implementacion)

### F1: Estado "Vendido" + Pagina /logros

**Problema:** El vendedor no sabe si su gestion resulto en venta.

**Solucion:**
- Predicciones con `status='completed'` (atribuidas automaticamente)
  desaparecen de `/contactar` y aparecen en `/logros`
- Nueva pagina `/logros` en el menu de navegacion

**Estructura de /logros:**

Zona superior — 3 KPI cards motivacionales:

| Card | Valor | Subtitulo |
|------|-------|-----------|
| Ventas atribuidas | N | "predicciones convertidas este mes" |
| Monto atribuido | $X | "valor generado con PymePilot" |
| Racha | N | "ventas consecutivas (dias habiles)" |

Racha: cuenta dias habiles (lun-vie) consecutivos con al menos una
conversion. Se resetea si pasa un dia habil sin conversiones.

Zona inferior — Lista de predicciones convertidas:

Cada card muestra:
- Nombre del cliente + monto de la orden
- Vertical que genero la prediccion + hace cuanto se concreto
- Productos comprados (de order_items via attribution_order_id)
- Mini-analisis del patron del cliente:
  - Recurrente: frecuencia promedio + si esta compra fue dentro del patron
  - Nuevo: "Primera compra" o "Segunda compra — se esta fidelizando"
  - Inactivo recuperado: "Volvio despues de X dias sin comprar"

Filtros: por mes (selector), por vertical (chips)
Orden: mas recientes primero

**Datos necesarios:**
- `predictions` con `status='completed'` + metadata.attribution_amount (ya existe)
- `orders` via metadata.attribution_order_id (ya existe)
- `order_items` para detalle de productos (ya existe)
- Historial de orders del cliente para patron de recompra (ya existe)

**Backend:**
- 1 RPC nueva: JOIN predictions + orders + order_items + calculo de patron
- Sin cambios en motor Python (la atribucion automatica ya alimenta esto)

**Seguridad:**
- RPC filtrada por tenant_id (RLS activo en predictions, orders, order_items)
- Solo lectura
- No expone datos sensibles

---

### F4: KPI "Ventas Realizadas" en /metricas

**Problema:** No hay visibilidad del volumen total de operaciones del ERP.

**Solucion:**
Nueva card en la grilla de KPIs de /metricas:

```
Ventas Realizadas
47 ordenes        (flecha) 12% vs mes anterior
$850,000          (42 ordenes / $760,000 en febrero)
```

Cuenta TODAS las ordenes del ERP, no solo las atribuidas a PymePilot.
Incluye comparacion con mes anterior (% y valores absolutos).

**Backend:**
- 1 RPC nueva: COUNT + SUM sobre orders, mes actual y mes anterior
- Filtrada por tenant_id, status='completed'

**Seguridad:**
- RLS activo en orders
- Solo lectura, datos agregados

---

### F3: Filtros avanzados en /contactar

**Problema:** El vendedor no puede priorizar eficientemente. Solo tiene
filtro por vertical.

**Solucion:**
Dropdown "Ordenar por" (shadcn Select) al lado de los chips de vertical:

| Opcion | Criterio SQL | Para que sirve |
|--------|-------------|----------------|
| Mas urgentes primero | priority ASC (default) | Priorizar por urgencia del sistema |
| Clientes mas importantes | client_rankings.total_revenue DESC | Atender primero a los que mas facturan |
| Mayor monto potencial | confidence_score * total_revenue DESC | Oportunidades mas grandes |
| Mas recientes primero | prediction_date DESC | Ver que hay nuevo hoy |

**Implementacion:**
- Modificar query existente en contactar/page.tsx
- JOIN con vista materializada client_rankings para facturacion historica
- Parametro sort_by validado contra lista cerrada (NUNCA concatenar al SQL)

**Seguridad:**
- sort_by validado server-side contra enum de opciones permitidas
- client_rankings ya respeta tenant isolation via la query que la genera
- No se expone el SQL al frontend — solo el nombre de la opcion

---

### F2: Notificaciones Push

**Problema:** El vendedor no entra al dashboard si no tiene un empujon.

**Solucion:**
Web Push API (estandar del navegador, costo $0).

**Componentes:**
1. Service Worker registrado en el frontend
2. Banner de activacion con copy motivacional:
   "Activa las notificaciones para recibir un resumen diario de tus
   clientes a contactar y enterarte al instante cuando se concrete
   una venta."
3. Tabla push_subscriptions (tenant_id, user_id, endpoint, keys, created_at)
4. Libreria pywebpush en backend para disparar notificaciones
5. VAPID keys en .env

**Tipos de notificacion:**

| Tipo | Cuando se dispara | Mensaje ejemplo |
|------|-------------------|-----------------|
| Resumen diario | Post-orquestador (~5:15 AM) | "Tenes 5 clientes para contactar hoy" |
| Venta atribuida | Post-atribucion | "Juan Perez compro $15,000" |
| Prediccion urgente | Cuando hay priority=1 | "Prediccion urgente: Maria Garcia" |

**Flujo:**
```
Vendedor entra al dashboard primera vez
  -> Banner motivacional de activacion
  -> Acepta -> Se registra subscription en push_subscriptions
  -> Listo (una sola vez)

Orquestador 5AM:
  -> Sync -> Atribucion -> Verticales
  -> INSERT en notifications
  -> pywebpush envia a cada subscription activa del tenant
```

**Seguridad:**
- VAPID keys en .env (nunca en codigo)
- push_subscriptions con RLS por tenant_id
- Endpoint de suscripcion validado (debe ser HTTPS)
- Rate limit: maximo 10 push por dia por subscription
- Migration con rollback

**INCERTIDUMBRE:** Soporte de Web Push en iOS Safari (desde 16.4) puede
ser menos confiable que en Android/Chrome. Verificar dispositivo del
vendedor IEY antes de implementar.

**Costo de mantenimiento:** $0. Web Push API es estandar abierto (W3C).
pywebpush es open source. VAPID keys se generan una vez. Cada push
son ~200 bytes de ancho de banda.

---

## Resumen de cambios por capa

### Base de datos (migraciones nuevas)
- RPC get_achievements(): JOIN predictions + orders + order_items + patron
- RPC get_total_sales(): COUNT + SUM orders mes actual y anterior
- Tabla push_subscriptions (F2)
- RLS en push_subscriptions (F2)

### Backend Python
- Paso nuevo en orquestador: generar notificaciones post-verticales
- Funcion de push via pywebpush
- VAPID keys en .env

### Frontend Next.js
- Nueva pagina /logros (F1)
- Nueva card KPI en /metricas (F4)
- Dropdown ordenamiento en /contactar (F3)
- Service Worker + banner de activacion (F2)
- Icono /logros en navegacion (sidebar + bottom nav)

---

## Lo que NO incluye este bloque

- Notificaciones por email
- Notificaciones por WhatsApp (eliminado del plan)
- Bulk actions (marcar varias predicciones a la vez)
- Dark mode
- Export desde historial
- Afinacion de prompts/ventanas (requiere semanas de datos)
