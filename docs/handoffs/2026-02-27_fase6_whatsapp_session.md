# Handoff: Fase 6 — WhatsApp Integration (Rediseñada)

**Fecha:** 2026-02-27
**Sesion:** Brainstorming + implementacion Parte 1 + design doc
**Commits:** `be1dc66` (boton wa.me), `44972a1` (design doc)

---

## Que se hizo

### 1. Brainstorming Fase 6

La Fase 6 original contemplaba integración con Kommo CRM. Se rediseñó porque:
- Ningun distribuidor PyME tiene CRM (menos aun Kommo)
- Kommo agrega complejidad innecesaria como intermediario
- El vendedor usa el celular — un boton directo a WhatsApp es mas natural

**Decisión:** Eliminar Kommo, dividir en 2 partes:
- Parte 1: Boton wa.me directo en dashboard
- Parte 2: Notificacion diaria via WA Cloud API (futura, requiere SIM chip)

### 2. Implementacion Parte 1 — Boton wa.me (commit be1dc66)

**Archivos nuevos:**
- `frontend/src/components/predictions/whatsapp-button.tsx` — Componente client-side

**Archivos modificados:**
- `frontend/src/components/predictions/prediction-card.tsx` — Bloque WhatsApp reemplaza CopyButton

**Flujo:**
1. Cada tarjeta con mensaje sugerido muestra bloque verde "Enviar por WhatsApp"
2. Instruccion: "Al tocar el boton se copia el mensaje y se abre WhatsApp. Busca al cliente en tus contactos, pega el mensaje y listo."
3. Al tocar: copia al portapapeles + abre `https://wa.me/` (sin numero, el vendedor busca)
4. Feedback visual: boton cambia a "Copiado" por 3 segundos

**Decisiones clave:**
- Sin telefono en wa.me link: 74% de clientes IEY tienen telefono vacio en la DB
- CopyButton eliminado: redundante con el nuevo flujo WhatsApp
- 3 iteraciones de UX con Pato hasta llegar al diseño final

**Probado por Pato desde celular** — funciona correctamente.

### 3. Design doc (commit 44972a1)

`docs/plans/2026-02-27-fase6-whatsapp-design.md` documenta:
- Parte 1 (completada)
- Parte 2: arquitectura de notificacion diaria, tabla wa_notifications, pasos de implementacion
- 6 features futuras de WhatsApp registradas para cuando escale

---

## Estado completo de fases

| Fase | Estado | Auditoria |
|------|--------|-----------|
| Fase 0 | COMPLETADA | N/A |
| Fase 1 | COMPLETADA | AUDITADA 0C/0H |
| Fase 2 (Motor) | COMPLETADA | AUDITADA 0C/0H |
| Fase 3 (Dashboard) | COMPLETADA | AUDITADA 0C/0H |
| Smart File Upload | COMPLETADO | Cubierto en audit Ingesta |
| Ingesta Fase 2 | COMPLETADA | AUDITADA 0C/0H |
| Fase 4 (Automatizacion) | COMPLETADA | AUDITADA 0C/0H |
| Fase 5 (V1+V4) | COMPLETADA | AUDITADA 0C/0H |
| **Fase 6 (WhatsApp)** | **Parte 1 DONE, Parte 2 PENDIENTE** | Parte 1 sin auditar |

**26 migraciones ejecutadas** (001-025 + rollbacks)

---

## Pendientes y bloqueantes

### Fase 6 Parte 2 — Bloqueada
- Notificacion diaria via WA Cloud API
- **Bloqueante:** SIM chip para verificar numero en Meta Business
- Design doc listo: `docs/plans/2026-02-27-fase6-whatsapp-design.md`

### MEDIUMs diferidos de auditorias anteriores (no bloquean produccion)
- M-Sec-01: `str(exc)` sin `sanitize_text()` en base.py
- M-Sec-02: metadata completa enviada al browser
- M-FE-01: Normalizacion customer duplicada server/client
- M-FE-02: cross_sell ausente en vertical-filter.tsx
- M-Py-01 a M-Py-04: type hints, null guards, calculo duplicado
- M-DB-01: 3 queries con pattern repetido CASE/BETWEEN

### Error pre-existente
- `IndeterminateDatatype` en `update_prediction_attribution()` — NO introducido por Fase 5

---

## Proxima fase: Fase 7 — V3 Cross-Sell + KPIs Avanzados

Segun `docs/ROADMAP.md` (Semanas 15-17):

1. **V3 Cross-Sell** — recomendar productos que el cliente nunca compro pero clientes similares si
2. **KPIs avanzados:**
   - Facturacion recurrente vs nueva (% y tendencia)
   - Tasa de churn mensual
   - Ticket promedio
   - Valor generado por PymePilot
3. **Graficos interactivos**
4. **Reportes exportables** (PDF/Excel)

---

## Prompt para iniciar sesion nueva

```
Lee el handoff en docs/handoffs/2026-02-27_fase6_whatsapp_session.md.

Fase 6 Parte 1 COMPLETADA (boton wa.me en dashboard, commit be1dc66).
Parte 2 bloqueada por SIM chip (design doc listo).
6 fases completadas + auditadas con 0C/0H.
26 migraciones ejecutadas.

Proxima tarea: decidir si Fase 7 (V3 Cross-Sell + KPIs) u otra prioridad.
Ver docs/ROADMAP.md seccion Fase 7.
```
