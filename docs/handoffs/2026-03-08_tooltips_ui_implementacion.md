# Handoff — Tooltips UI Implementacion

**Fecha:** 2026-03-08
**Sesion:** Implementacion feature Tooltips UI del backlog
**Estado:** COMPLETADO y deployado en produccion

---

## Que se hizo

Se implemento la feature "UI Explicativa — Tooltips informativos" segun
el design doc `docs/plans/2026-03-08-ui-tooltips-design.md`.

### Archivos nuevos
- `frontend/src/components/ui/info-tooltip.tsx` — Componente reutilizable
- `frontend/src/lib/tooltips.ts` — Diccionario centralizado (28 textos)

### Archivos editados (11 paginas/componentes)
- Home: `frontend/src/app/(dashboard)/page.tsx` (4 tooltips en KPIs)
- Contactar: `frontend/src/components/predictions/prediction-card.tsx` (3: prioridad, vertical, confianza)
- Metricas KPIs: `frontend/src/app/(dashboard)/metricas/metricas-content.tsx` (5 tooltips)
- Metricas graficos: `charts/revenue-chart.tsx`, `churn-chart.tsx`, `ticket-chart.tsx`, `value-chart.tsx` (4 titulos)
- Metricas ranking: `client-ranking-table.tsx` (6 headers de tabla)
- Datos: `frontend/src/app/(dashboard)/datos/page.tsx` (2: registros, sync counts)
- Historial: `frontend/src/app/(dashboard)/historial/page.tsx` (1 titulo)
- Logros: `frontend/src/app/(dashboard)/logros/logros-content.tsx` (3 KPIs)

### Commits
- `b8d800e` docs: brainstorming backlog — 4 design docs aprobados
- `73ac5bf` feat: tooltips informativos UI — 28 tooltips en 6 paginas

## Decisiones tecnicas

1. **Sin dependencias nuevas:** Componente CSS/Tailwind puro, sin Radix ni shadcn.
   El proyecto no usaba Radix y no hacia falta agregarlo para tooltips simples.

2. **Portal + position:fixed:** Primera version usaba `position: absolute` pero
   se cortaba por `overflow-hidden` en el layout del dashboard. Se reescribio
   usando `createPortal(document.body)` + `position: fixed` + calculo dinamico
   de coordenadas con `getBoundingClientRect()`.

3. **Ajuste automatico de bordes:** El tooltip detecta si hay espacio arriba
   (default) o abajo, y se clampea horizontalmente para no salirse de pantalla.
   La flechita sigue al icono incluso cuando el tooltip se desplazo.

4. **Diccionario centralizado:** Todos los textos en `tooltips.ts` con claves
   `pagina.dato`. Facilita editar textos sin tocar componentes.

## Bug encontrado y corregido en sesion

- Tooltips se cortaban en varias paginas (Home "tasa contacto", Historial,
  Metricas "ventas del mes", Logros "ventas con PymePilot") por
  `overflow-hidden` en contenedores padres. Corregido con portal approach.

## Proxima feature sugerida

**Chatbot IA (PymePilot Asesor)** — design doc en
`docs/plans/2026-03-08-chatbot-ia-asesor-design.md`. Es la feature de
mayor impacto del backlog.

## Contexto relevante

- Crontab parcialmente desactivado (ver MEMORY.md)
- Ticket Contabilium pendiente (Jira, 2026-03-07)
- Deploy: `cd frontend && bash deploy.sh`
- Orden completo del backlog: Tooltips (DONE) → Chatbot IA → Pipeline CRM → Dashboard Metricas
