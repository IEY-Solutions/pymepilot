# Handoff: Pipeline CRM — Sesión 2

**Fecha:** 2026-03-09
**Commit:** (ver commit de esta sesión)
**Estado:** Copy dinámico funcionando, UX de seguimientos pendiente de mejora

## Lo que se hizo en esta sesión

### 1. Fix copy dinámico — 3 bugs encontrados y resueltos

**Bug 1: ANTHROPIC_API_KEY no disponible en el container Docker**
- `docker-compose.yml` solo pasaba variables `NEXT_PUBLIC_*` como build args
- Las variables de runtime del servidor (ANTHROPIC_API_KEY, CHAT_MODEL, etc.) nunca llegaban al container
- **Fix:** Agregado `env_file: .env.local` al docker-compose.yml
- **Impacto:** Esto también afectaba al chatbot (/asesor) en producción

**Bug 2: PostgREST no reconocía la columna `stage_message_text` (PGRST204)**
- La migración 042 hizo `ALTER TABLE` sin `NOTIFY pgrst, 'reload schema'`
- PostgREST mantenía su cache del schema viejo y rechazaba el UPDATE
- **Fix:** Ejecutado NOTIFY y actualizada migración 042

**Bug 3: stage_message_text se sobreescribía entre etapas (1 solo campo TEXT)**
- El copy de cada etapa pisaba el anterior
- Si el vendedor volvía a una etapa, se regeneraba (gastando tokens)
- Si el usuario movía rápido, el copy llegaba desfasado (una etapa atrás)
- **Fix:** Migración 043 — reemplazo por `stage_messages JSONB DEFAULT '{}'`
  - Cache por etapa: `{ "en_seguimiento": "...", "por_cotizar": "...", ... }`
  - Si ya existe copy para una etapa → skip (ahorra tokens)
  - Cada etapa muestra siempre su propio copy

### 2. Indicador visual "Actualizando propuesta..."

- `generatingCardIds` (Set) trackea qué cards están esperando respuesta de Claude
- Animación `✨ Actualizando propuesta...` con pulse en la card mientras Claude genera
- Se activa al mover (drag & drop) y al usar acciones del modal (contacto, followup, advance)
- Se desactiva cuando `refreshBoard()` completa

### 3. Modal reactivo

- `modalCard` cambió de estado independiente (`useState`) a derivado (`useMemo` de `cards`)
- Ahora cuando `refreshBoard()` actualiza `cards`, el modal abierto se actualiza automáticamente
- El copy dinámico aparece en el modal sin necesidad de cerrarlo y reabrirlo

### Migraciones aplicadas

- **042 (fix):** Agregado `NOTIFY pgrst, 'reload schema'`
- **043_stage_messages_jsonb.sql:** `stage_message_text TEXT` → `stage_messages JSONB DEFAULT '{}'`

## Problemas pendientes — Siguiente sesión

### Objetivo: Mejorar UX, lógica de traspaso y seguimientos escalonados

#### 1. UX de seguimientos programados (etapa "En seguimiento")
- Los followups se crean automáticamente al mover a "en_seguimiento" pero la experiencia no es clara
- El vendedor no ve fácilmente: cuál es el próximo seguimiento, cuándo es, cuántos quedan
- El flujo de "completar followup" vs "nuevo contacto" no es intuitivo
- **Recomendación:** Brainstorming con Pato sobre cómo debería verse y funcionar

#### 2. Lógica de traspaso de tarjetas
- Revisar las transiciones permitidas entre columnas (¿se puede ir de cualquiera a cualquiera?)
- ¿Qué pasa si arrastran una card de "cotización enviada" a "a contactar"? ¿Tiene sentido?
- ¿Los followups pendientes se limpian correctamente al cambiar de etapa?
- ¿Qué pasa con el estado de la prediction si la card retrocede?

#### 3. Reprogramación de seguimientos escalonados
- Actualmente la secuencia es fija por vertical (ej: reposición [2,5,10] días)
- Claude ajusta los plazos si hay nota, pero:
  - ¿Qué pasa si un followup se completa tarde? ¿Los siguientes se recalculan?
  - ¿Se pueden agregar followups manuales?
  - ¿Se puede cancelar un followup sin cancelar todos?
  - ¿Qué pasa si se completan todos los followups pero el cliente no avanzó?

#### 4. Borrar notas del timeline
- Endpoint DELETE `/api/pipeline/notes` está implementado
- Botón X aparece al hover sobre cada nota en el timeline
- Falta verificar que funcione correctamente en producción (no se testeó en esta sesión)

## Archivos clave (actualizados)

| Archivo | Qué cambió |
|---------|-----------|
| `frontend/docker-compose.yml` | Agregado `env_file: .env.local` para runtime vars |
| `frontend/src/app/api/pipeline/route.ts` | Cache JSONB en `generateStageCopy`, logging completo |
| `frontend/src/components/pipeline/pipeline-board.tsx` | `generatingCardIds`, `modalCard` reactivo via `useMemo` |
| `frontend/src/components/pipeline/pipeline-card.tsx` | Indicador "Actualizando propuesta..." con Sparkles |
| `frontend/src/components/pipeline/pipeline-column.tsx` | Prop `generatingCardIds` |
| `frontend/src/components/pipeline/contact-modal.tsx` | `SuggestedMessage` lee `stage_messages[column_name]` |
| `frontend/src/lib/pipeline/types.ts` | `stage_message_text` → `stage_messages: Record<string, string>` |
| `frontend/src/app/(dashboard)/pipeline/page.tsx` | Query actualizado a `stage_messages` |
| `database/migrations/042_stage_message.sql` | Agregado NOTIFY |
| `database/migrations/043_stage_messages_jsonb.sql` | Nueva: TEXT → JSONB con cache por etapa |

## Notas técnicas para la próxima sesión

- `env_file: .env.local` inyecta TODAS las variables al container. Si se agregan nuevas variables de runtime al `.env.local`, estarán disponibles automáticamente.
- El log debug `[pipeline-GET]` está todavía activo en route.ts. Considerar removerlo.
- Las cards que ya fueron testeadas tienen `stage_messages` cacheados. Para testear regeneración, se puede limpiar con: `UPDATE pipeline_cards SET stage_messages = '{}';`
- PostgREST necesita `NOTIFY pgrst, 'reload schema'` después de CUALQUIER DDL. Recordar en futuras migraciones.
