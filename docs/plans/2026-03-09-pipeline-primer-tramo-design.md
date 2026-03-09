# Design Doc: Pipeline CRM — Primer Tramo UX

**Fecha:** 2026-03-09
**Estado:** Aprobado
**Scope:** A contactar → Contactado → En seguimiento

## Problema

1. Badge de followup se muestra en cualquier columna (bug)
2. "Contactado" solo tiene "Agregar nota" — no permite registrar resultado
3. Followups pendientes quedan huerfanos al salir de "En seguimiento"
4. El modal no explica que se espera del vendedor en cada etapa
5. Tooltips de columna no explican el flujo

## Cambios

### 1. Badge followup: solo en "en_seguimiento"
- `pipeline-card.tsx`: agregar condicion `card.column_name === "en_seguimiento"`

### 2. "Contactado" = etapa de espera activa
- `contact-modal.tsx`: cambiar de `NoteOnlyActions` a `ContactActions` para "contactado"
- Agregar banner de contexto por etapa arriba de las acciones

### 3. Limpiar followups al salir de "En seguimiento"
- `route.ts` handleMove: marcar followups pendientes como skipped al salir de en_seguimiento

### 4. Textos de contexto en modal
- Banner por etapa que explica que hacer

### 5. Tooltips actualizados
- `tooltips.ts`: textos mas claros para a_contactar, contactado, en_seguimiento

## Fuera de scope
- Timer automatico Contactado → En seguimiento
- Followups manuales
- Cambios en etapas finales del pipeline
