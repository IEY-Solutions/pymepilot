# Handoff: Pipeline CRM — Sesión 3

**Fecha:** 2026-03-09
**Commit:** 3dff16f (design doc followups completo)
**Estado:** Design doc aprobado, implementación pendiente

## Lo que se hizo en esta sesión

### 1. Pipeline primer tramo — UX y lógica (commit 8bf4158)

**5 cambios implementados y deployados:**

1. **Badge followup solo en "en_seguimiento"** — fix bug donde el badge se mostraba en cualquier columna
2. **"Contactado" con botones de resultado** — antes solo tenía "Agregar nota", ahora tiene Contestó/No contestó/Pidió cotización
3. **Limpieza followups al salir de "en_seguimiento"** — followups pendientes se marcan como skipped al mover la card fuera
4. **Banners de contexto por etapa** — banner azul con Info icon que explica qué hacer en cada etapa
5. **Tooltips de columna actualizados** — textos más claros para a_contactar, contactado, en_seguimiento

**Nuevo flujo de transiciones (primer tramo):**
- A contactar → (cualquier resultado) → Contactado
- A contactar → (pidió cotización) → Por cotizar
- Contactado → (contestó) → se queda en Contactado + nota
- Contactado → (no contestó) → En seguimiento (con followups)
- Contactado → (pidió cotización) → Por cotizar

**Cambio en copy dinámico:** "contactado" agregado a STAGE_COPY_COLUMNS con su propia intención.

### 2. Design doc: Sistema de followups completo (commit 3dff16f)

Design doc aprobado en `docs/plans/2026-03-09-followups-completo-design.md`.

**Decisiones clave del brainstorming:**
- "En seguimiento" centraliza TODOS los seguimientos (de cualquier etapa)
- Timers fijos: Contactado 2 días, Por cotizar 1 día, Cotización enviada 1 día
- Timers se evalúan al cargar el board (GET /api/pipeline), no cron
- Secuencias diferenciadas por origen: contactado=[por vertical], por_cotizar=[1,3,5], cotizacion_enviada=[2,4,7]
- Badge compacto en card + plan completo en modal (4 etapas activas)
- Push notifications obligatorio + Notion/Google Calendar diseñados para fase futura
- "Vendido" registra next_reposition_estimate, motor Python genera nueva oportunidad

## Implementación pendiente — 9 pasos

| # | Paso | Descripción |
|---|------|-------------|
| 1 | Migración SQL | stage_deadline, origin_stage, followup_notifications, next_reposition_estimate |
| 2 | Timers en GET | Auto-mover cards con stage_deadline vencido a "En seguimiento" |
| 3 | Badges en cards | Mostrar estado de espera en Contactado, En seguimiento, Por cotizar, Cotización enviada |
| 4 | Plan en modal | Sección "Plan de seguimiento" con timeline de fechas concretas |
| 5 | origin_stage en handlers | handleContact/handleMove pasan origin_stage al crear followups |
| 6 | Secuencias por origen | [1,3,5] para por_cotizar, [2,4,7] para cotizacion_enviada |
| 7 | Push notifications | Detectar followups del día en GET, enviar push, registrar en followup_notifications |
| 8 | Vendido + reposición | Calcular next_reposition_estimate al cerrar venta |
| 9 | (Futuro) Notion + Calendar | OAuth + crear tareas/eventos al programar followups |

## Archivos clave (estado actual)

| Archivo | Qué tiene |
|---------|-----------|
| `frontend/src/app/api/pipeline/route.ts` | Handlers: move, contact, complete_followup, advance. Lógica de transiciones con fromColumn. generateStageCopy con cache JSONB |
| `frontend/src/components/pipeline/pipeline-board.tsx` | DndContext, generatingCardIds, modalCard reactivo via useMemo |
| `frontend/src/components/pipeline/pipeline-card.tsx` | Badge followup condicional (solo en_seguimiento), badges prioridad/vertical |
| `frontend/src/components/pipeline/contact-modal.tsx` | StageContextBanner, ContactActions/AdvanceActions adaptativas, Timeline, SuggestedMessage |
| `frontend/src/lib/pipeline/types.ts` | ColumnName, Vertical, FOLLOWUP_SEQUENCES, PipelineCard, Followup, ContactNote |
| `frontend/src/lib/tooltips.ts` | Tooltips actualizados para pipeline |
| `database/migrations/041_pipeline.sql` | Schema base: pipeline_cards, followups, contact_notes |
| `database/migrations/043_stage_messages_jsonb.sql` | stage_messages JSONB cache |
| `docs/plans/2026-03-09-followups-completo-design.md` | Design doc completo aprobado |

## Notas técnicas

- `NoteOnlyActions` fue eliminado (antes se usaba para "contactado")
- `handleContact` ahora consulta `card.column_name` para determinar targetColumn según la etapa de origen
- `fromColumn` en handleMove se obtiene con query previa al UPDATE
- Al salir de "en_seguimiento", followups pendientes se marcan como skipped
- STAGE_COPY_COLUMNS ahora incluye "contactado"
- Log debug `[pipeline-GET]` sigue activo — considerar remover
- Docker runtime vars via `env_file: .env.local` en docker-compose.yml
