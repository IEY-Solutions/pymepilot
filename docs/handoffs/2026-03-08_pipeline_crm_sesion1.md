# Handoff: Pipeline CRM — Sesión 1

**Fecha:** 2026-03-08
**Commit:** cee1885
**Estado:** Parcialmente implementado, 2 problemas pendientes

## Lo que se hizo

### Pipeline CRM Kanban (funcional)
- **6 columnas:** A contactar → Contactado → En seguimiento → Por cotizar → Cotización enviada → Vendido
- **Drag & drop** con @dnd-kit/core (PointerSensor + TouchSensor)
- **Cards** con nombre, vertical, prioridad, teléfono/email, tiempo en columna, última nota
- **Modal adaptativo** por etapa: ContactActions, NoteOnlyActions, AdvanceActions, read-only para vendido
- **Timeline de actividad** dentro del modal (notas + evento de creación)
- **Followups automáticos** al mover a "en_seguimiento" (secuencia por vertical: reposición [2,5,10], activación [1,3,7], etc.)
- **Ajuste de followups con Claude** cuando hay nota del vendedor (adjustFollowupsWithClaude)
- **Descartar cards** vencidas (>3 días en a_contactar)
- **Sync automático** de predicciones al pipeline via función SQL
- **Sidebar slim** (w-14, solo iconos, tooltip CSS on hover)
- **Layout full-width** para que quepan las 6 columnas

### Migraciones aplicadas
- **041_pipeline.sql:** 3 tablas (pipeline_cards, followups, contact_notes) + RLS + sync function
- **042_stage_message.sql:** columna stage_message_text en pipeline_cards

### Design doc aprobado
- `docs/plans/2026-03-08-copy-dinamico-pipeline-design.md`

## Problemas pendientes (lo que NO funciona)

### 1. Copy dinámico NO se actualiza en la UI
**Síntoma:** Al mover una card entre etapas, el mensaje sugerido en el modal sigue mostrando el copy original de la predicción. No se actualiza al copy generado por Claude.

**Código involucrado:**
- `route.ts`: `generateStageCopy()` y `generateStageCopyForCard()` — generan copy llamando a Claude y hacen UPDATE en `pipeline_cards.stage_message_text`
- `pipeline-board.tsx`: después del move hace `refreshBoard()` para recargar las cards
- `contact-modal.tsx`: `SuggestedMessage` muestra `card.stage_message_text` con fallback a `prediction.message_text`

**Posible causa:** No se pudo debuggear en esta sesión. Podría ser:
- Claude devolviendo un error silencioso (el catch no loguea nada visible)
- El `refreshBoard()` trayendo la card antes de que el UPDATE de stage_message_text se complete
- El SELECT del GET no incluyendo stage_message_text correctamente
- **Recomendación:** Agregar console.log en `generateStageCopy` para ver si se llama, si Claude responde, y si el UPDATE funciona. Verificar en la DB si stage_message_text se está guardando: `SELECT id, column_name, stage_message_text FROM pipeline_cards;`

### 2. UX de seguimientos programados no convence a Pato
**Síntoma:** Pato no está conforme con cómo funciona la etapa "En seguimiento". Los followups se crean automáticamente pero la experiencia no le cierra.

**Estado actual:**
- Al mover a "en_seguimiento", se crean followups con la secuencia default de la vertical
- En el modal de "en_seguimiento" se muestran ContactActions (Contestó/No contestó/Pidió cotización)
- Si hay un followup activo pendiente, el submit completa ese followup
- Si no hay followup activo, el submit crea un nuevo contacto

**Lo que Pato quiere (interpretar en la próxima sesión):**
- Probablemente: que se vea claramente cuál es el próximo seguimiento programado (fecha)
- Probablemente: poder ver la lista de seguimientos pendientes/completados
- Probablemente: que el flujo sea más intuitivo sin necesidad de entender la mecánica interna
- **Recomendación:** Hacer brainstorming con Pato sobre el UX deseado para seguimientos antes de codear

### 3. Borrar notas del timeline (implementado pero no deployado)
- Endpoint DELETE en `/api/pipeline/notes` está listo
- Botón X aparece al hacer hover sobre cada nota en el timeline
- `handleDeleteNote` en pipeline-board.tsx actualiza el estado local sin cerrar el modal
- Falta deployar y verificar que funcione

## Archivos clave

| Archivo | Qué hace |
|---------|----------|
| `frontend/src/app/api/pipeline/route.ts` | GET (fetch board) + POST (7 acciones: sync, move, contact, complete_followup, discard, add_note, advance) + generateStageCopy + adjustFollowupsWithClaude |
| `frontend/src/app/api/pipeline/notes/route.ts` | GET notas + DELETE nota |
| `frontend/src/components/pipeline/pipeline-board.tsx` | Board Kanban con DndContext, handlers, modal state |
| `frontend/src/components/pipeline/contact-modal.tsx` | Modal adaptativo: SuggestedMessage, Timeline, ContactActions, AdvanceActions |
| `frontend/src/components/pipeline/pipeline-card.tsx` | Card draggable con info del cliente |
| `frontend/src/components/pipeline/pipeline-column.tsx` | Columna droppable |
| `frontend/src/lib/pipeline/types.ts` | Todos los tipos + constantes (COLUMN_ORDER, FOLLOWUP_SEQUENCES, etc.) |
| `database/migrations/041_pipeline.sql` | Schema del pipeline (3 tablas + RLS + sync function) |
| `database/migrations/042_stage_message.sql` | Columna stage_message_text |

## Dependencias instaladas
- `@dnd-kit/core` ^6.3.1
- `@dnd-kit/utilities` ^3.2.2
