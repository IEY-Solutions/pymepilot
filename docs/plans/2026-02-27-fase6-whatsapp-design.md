# Fase 6 — WhatsApp Integration (Rediseñada)

**Fecha:** 2026-02-27
**Estado:** Parte 1 COMPLETADA, Parte 2 PENDIENTE (bloqueada por SIM chip)

---

## Contexto

La Fase 6 original (ROADMAP.md, Semanas 13-15) contemplaba integración con
Kommo CRM como intermediario para enviar mensajes WhatsApp. Se rediseñó por:

1. **Ningún distribuidor PyME tiene CRM** — agregar Kommo introduce complejidad
   innecesaria y una dependencia que el usuario no necesita ni quiere.
2. **El vendedor usa el celular como herramienta principal** — un botón directo
   a WhatsApp es mas natural que un CRM.
3. **Simplicidad > features** — el dashboard ya tiene el mensaje sugerido,
   solo falta llevarlo a WhatsApp con el menor friccion posible.

---

## Parte 1: Botón wa.me en Dashboard — COMPLETADA

**Commit:** `be1dc66`
**Archivos:** `whatsapp-button.tsx`, `prediction-card.tsx`

### Flujo

1. Vendedor abre "Contactar Hoy" en el dashboard
2. Cada tarjeta con mensaje sugerido muestra un bloque verde "Enviar por WhatsApp"
3. Al tocar el botón:
   - Se copia el mensaje al portapapeles (clipboard API + fallback)
   - Se abre `https://wa.me/` en nueva pestaña
   - WhatsApp se abre sin destinatario preseleccionado
4. El vendedor busca al cliente en sus contactos, pega el mensaje, envia

### Decisiones de diseño

- **Sin teléfono en wa.me link:** El 74% de clientes IEY tienen teléfono vacío.
  En vez de esperar datos limpios, el vendedor busca manualmente. Mas robusto.
- **Bloque visual destacado:** Fondo verde con ícono, título e instrucciones
  detalladas. El vendedor entiende qué va a pasar antes de tocar.
- **Feedback "Copiado":** El botón cambia a "Copiado" por 3 segundos para
  confirmar que el mensaje está en el portapapeles.

---

## Parte 2: Notificación Diaria al Vendedor — PENDIENTE

### Qué hace

Cada mañana después del orquestador (5 AM), PymePilot envía un mensaje
WhatsApp al vendedor del tenant con un resumen de predicciones del día.

### Ejemplo de mensaje (template)

```
Buenos días! PymePilot tiene {{count}} clientes para contactar hoy:

1. {{cliente_1}} — {{vertical_1}}
2. {{cliente_2}} — {{vertical_2}}
3. {{cliente_3}} — {{vertical_3}}
{{#if more}}
...y {{more}} más.
{{/if}}

Ver detalle: https://app.pymepilot.cloud/contactar
```

### Arquitectura

```
Orquestador (5 AM)
  └── sync → verticales → predictions
        └── POST-HOOK: notification_job
              └── WhatsApp Cloud API (graph.facebook.com)
                    └── Mensaje al vendedor con template aprobado
```

### Requisitos técnicos

| Requisito | Estado |
|-----------|--------|
| Meta Business Account | Pato tiene cuenta |
| Número dedicado con SIM | Número existe, esperando chip físico |
| Verificación del número en Meta | Pendiente (requiere SIM activo) |
| Template aprobado por Meta | Pendiente (24-48hs review) |
| WhatsApp Cloud API access | Pendiente (se habilita al verificar) |

### Stack técnico

- **API:** WhatsApp Cloud API via `graph.facebook.com/v21.0/`
- **Auth:** System User Token (long-lived, generado en Meta Business Settings)
- **Templates:** Creados en WhatsApp Manager, aprobados por Meta
- **Costo:** 1000 conversaciones service-initiated/mes GRATIS (tier Argentina).
  IEY usa ~30/mes (1 por día). Costo = $0.
- **Implementación:** Script Python post-orquestador, misma infra existente

### Tabla nueva: `wa_notifications`

```sql
CREATE TABLE wa_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    recipient_phone TEXT NOT NULL,
    template_name TEXT NOT NULL,
    template_params JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    wa_message_id TEXT,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Pasos para implementar (cuando llegue el chip)

1. Activar SIM, verificar número en Meta Business
2. Crear template de mensaje, esperar aprobación
3. Migración SQL: tabla `wa_notifications`
4. Script `backend/scripts/send_daily_notification.py`
5. Agregar como post-hook en orquestador
6. Test E2E con número de Pato
7. Deploy

---

## Features Futuras de WhatsApp

Registradas para implementar cuando PymePilot escale a más clientes.
Todas usan la misma infra de WA Cloud API.

| # | Feature | Descripción | Trigger | Prioridad |
|---|---------|-------------|---------|-----------|
| 1 | **Resumen diario** | Top predicciones + link dashboard | Post-orquestador 5 AM | Alta (Parte 2) |
| 2 | **Alerta urgente** | Cliente VIP con predicción prioridad 1 | Inmediato post-vertical | Media |
| 3 | **Recordatorio** | "No abriste el dashboard hoy" | 11 AM si no hubo login | Media |
| 4 | **Alerta de datos** | "Hace X días no se actualizan datos" | Check frescura 5:30 AM | Baja |
| 5 | **Confirmación atribución** | "El cliente X compró! Tu mensaje funcionó" | Post-atribución | Baja |
| 6 | **Reporte semanal** | Resumen: contactados, atribuidos, revenue | Lunes 9 AM | Baja |

### Notas para implementación futura

- Features 2-3 requieren tracking de actividad del vendedor (login timestamps)
- Feature 5 requiere que atribución esté refinada (hoy es best-effort)
- Feature 6 requiere métricas agregadas que hoy no se calculan
- Todas comparten la misma tabla `wa_notifications` y el mismo token de API
- Rate limit: máximo 1 mensaje por feature por vendedor por día

---

## Qué NO se hace

- **Kommo CRM:** Eliminado del plan. Sin dependencia de CRM externos.
- **wa.me con número precargado:** Descartado por datos de teléfono incompletos.
- **WhatsApp Business API ahora:** Bloqueado por SIM chip. Se implementa
  cuando el chip llegue, no antes.
- **Features 2-6 ahora:** Solo IEY por meses. Se implementan cuando haya
  más clientes.
