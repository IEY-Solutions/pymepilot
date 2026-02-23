# Handoff — Fase 3 Dashboard MVP (Planificación)
**Fecha:** 2026-02-23
**Estado:** Plan aprobado, implementación NO iniciada

---

## Resumen

La Fase 3 fue planificada completamente y el plan fue aprobado por Pato.
NO se ejecutó ningún código ni migración. Todo está en estado de planificación.

## Plan completo

El plan está en el mensaje inicial de la sesión de implementación.
Estructura: 3 sub-fases, 7 sesiones.

| Sub-fase | Sesiones | Foco |
|----------|----------|------|
| **3A** | 2 | Consolidar DB en orion_db + migrar RLS para JWT + usuario test |
| **3B** | 2 | Next.js init + auth + layout mobile-first |
| **3C** | 3 | Páginas: Contactar Hoy, KPIs, Historial, Datos |

## Decisiones clave tomadas

1. **Consolidar DB:** Las tablas de PymePilot deben moverse de `postgres` a `orion_db` porque PostgREST y GoTrue apuntan a `orion_db`
2. **Data access:** Supabase JS Client (PostgREST), NO custom API routes
3. **RLS dual-mode:** Función `get_current_tenant_id()` que lee `app.tenant_id` (Python) O JWT claims (dashboard)
4. **Tablas N8N en orion_db:** ~50 tablas de N8N en schema `public`. Sin GRANT para `authenticated`. Aceptable para MVP.
5. **Navegación:** 4 items (Inicio, Contactar, Historial, Datos)
6. **Mobile-first:** Bottom nav en mobile, sidebar en desktop

## Pendiente ANTES de empezar implementación

- **Instalar MCP Context7** — se empezó pero no se completó. Context7 da docs actualizadas de Next.js, Supabase, etc. dentro de Claude Code.
  - Se necesita verificar que `npx` / Node.js están instalados en el VPS
  - Configurar en `.claude/settings.json` o `.claude/settings.local.json`

## Orden de implementación

1. Migración 016: Crear tablas en orion_db + copiar datos
2. Migración 017: Dual-mode RLS + usuario GoTrue test
3. Next.js project + auth (Supabase SSR)
4. Layout mobile-first (bottom nav + sidebar)
5. Página "Contactar Hoy" (la más importante)
6. Dashboard KPIs + Estado de Datos
7. Historial + pulido final

## Archivos de referencia

- Plan detallado: fue proporcionado en la sesión, copiar del prompt inicial
- `docs/ROADMAP.md` — roadmap general
- `docs/PRD.md` — product requirements
- `database/migrations/001-015` — migraciones existentes (para recrear en orion_db)
- `backend/engine/db/connection.py` — patrón set_tenant_context que debe seguir funcionando
- `/opt/orion-stack/docker-compose.yml` — config Supabase stack (read-only)

## Prompt para iniciar próxima sesión

```
Continuamos con la Fase 3 del dashboard MVP de PymePilot.
Lee el handoff en docs/handoffs/2026-02-23_fase3_planning_handoff.md
y el CLAUDE.md completo antes de empezar.

Pendientes en orden:
1. Instalar MCP Context7 (quedó pendiente)
2. Empezar con Sesión 3A-1: Migración 016 (consolidar tablas en orion_db)

El plan completo de la Fase 3 está aprobado. Implementar paso a paso,
explicando qué se hace y por qué (modo educativo).
```
