# Handoff: Pipeline CRM — Sesion 4

**Fecha:** 2026-03-10
**Commit:** 8cafa18
**Estado:** Sistema de followups completo implementado y deployado (pasos 1-8 de 9)

## Lo que se hizo en esta sesion

### 8 pasos implementados del design doc aprobado

| # | Paso | Descripcion |
|---|------|-------------|
| 1 | Migracion 044 | stage_deadline, origin_stage, next_reposition_estimate, followup_notifications |
| 2 | Timers en GET | Auto-move cards vencidas (contactado 2d, por_cotizar 1d, cotizacion_enviada 1d) |
| 3 | Badges en cards | "Esperando respuesta/cotizacion/cierre — Xd" en 3 etapas + followup mejorado |
| 4 | Plan en modal | Seccion "Plan de seguimiento" con timeline visual (bullets verdes/rojos/vacios) |
| 5 | origin_stage | Se guarda en todos los handlers que crean followups |
| 6 | Secuencias por origen | por_cotizar=[1,3,5], cotizacion_enviada=[2,4,7], contactado=por vertical |
| 7 | Push notifications | Banner amarillo "Seguimientos para hoy" con titulo + cuerpo |
| 8 | Vendido + reposicion | Calcula promedio dias entre ordenes, guarda next_reposition_estimate |

### Paso 9 (futuro)
Notion + Google Calendar — solo disenado, no implementado. Requiere OAuth, user_integrations table (ya disenada en design doc).

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `database/migrations/044_followups_completo.sql` | NUEVO: stage_deadline, origin_stage, next_reposition_estimate, followup_notifications |
| `database/migrations/044_rollback.sql` | NUEVO: rollback de 044 |
| `frontend/src/lib/pipeline/types.ts` | ORIGIN_SEQUENCES, STAGE_TIMERS, OriginStage, FollowupNotification, stage_deadline en PipelineCard, origin_stage en Followup, next_reposition_estimate en prediction |
| `frontend/src/app/api/pipeline/route.ts` | computeDeadline(), auto-move en GET, origin_stage en handlers, push notifications, computeAvgOrderInterval(), vendido+reposicion |
| `frontend/src/app/(dashboard)/pipeline/page.tsx` | Select incluye stage_deadline, origin_stage, next_reposition_estimate |
| `frontend/src/components/pipeline/pipeline-card.tsx` | deadlineBadge() para 3 etapas, origin label en followup badge |
| `frontend/src/components/pipeline/contact-modal.tsx` | FollowupPlan component, PlanStep, vendido con info reposicion |
| `frontend/src/components/pipeline/pipeline-board.tsx` | Notifications state, banner amarillo, Bell/X icons |

## Notas tecnicas

- `computeDeadline()` retorna NULL para etapas sin timer (a_contactar, en_seguimiento, vendido)
- Auto-move en GET es idempotente: solo mueve cards con deadline vencido que estan en etapas con timer
- Push notifications solo se crean 1 vez por followup (verifica existentes antes de insertar)
- `computeAvgOrderInterval()` usa ultimas 20 ordenes, minimo 7 dias, default 30 si < 2 ordenes
- followup_notifications tiene RLS + FORCE RLS como todas las tablas
- STAGE_TIMERS es Partial<Record<ColumnName, number>> — solo 3 etapas tienen timer

## Pipeline CRM — Estado final

El pipeline CRM esta feature-complete para el uso actual:
- Kanban 6 columnas con drag & drop
- Copy dinamico por etapa (Claude, cache JSONB)
- Followups con secuencias diferenciadas por origen
- Timers automaticos con auto-move
- Badges de estado en todas las etapas activas
- Plan de seguimiento visual en modal
- Push notifications in-app
- Cierre del ciclo con next_reposition_estimate
- Solo queda Notion + Google Calendar (fase futura, requiere OAuth)
