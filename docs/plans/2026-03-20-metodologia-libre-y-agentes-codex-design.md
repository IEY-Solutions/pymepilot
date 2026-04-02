# Design Doc: Metodologia Libre + Agentes Codex

**Fecha:** 2026-03-20
**Estado:** Aprobado e implementado
**Tareas Notion:** "Definir Metodologia Libre en Codex y Codex" + "Invocar agentes de Codex dentro de Codex"

---

## Problema

1. **Permisos excesivos:** Codex tenia 49 reglas individuales de allowlist en `settings.local.json`. Cada comando nuevo requeria aprobacion manual, interrumpiendo el flujo de trabajo.

2. **Agentes sin Codex:** Los 6 agentes especializados (`.codex/agents/`) solo funcionaban en Codex. Codex no tenia equivalente, limitando su capacidad de trabajo especializado.

---

## Solucion Implementada

### Tarea 1: Denylist + acceptEdits

**Filosofia:** Invertir de allowlist (todo prohibido excepto lo aprobado) a denylist (todo permitido excepto lo peligroso).

**Cambios en `settings.local.json`:**
- `defaultMode: "acceptEdits"` — auto-acepta ediciones de archivos
- 19 reglas deny para operaciones irreversibles:
  - Secrets: `.env*`, `credentials`, `*.key`, `*.pem`, `*.crt`
  - Destructivo: `rm -rf`, `sudo`, `chmod 777`, `chown`
  - Docker prod: `docker rm`, `docker volume rm`, `docker-compose down`
  - Git peligroso: `push --force`, `reset --hard`, `clean -f`, `branch -D`
- 13 reglas allow para MCP tools y WebFetch a dominios especificos

**Seccion de worktrees en AGENTS.md:**
- Regla proactiva para que la IA use worktrees automaticamente
- 6 escenarios que disparan worktree (refactoring multi-modulo, features con riesgo, cambios experimentales, archivos criticos, sesiones autonomas, trabajo paralelo)

### Tarea 2: Agentes TOML nativos para Codex

**6 archivos creados en `.codex/agents/`:**

| Archivo | Agente | Contenido |
|---------|--------|-----------|
| `security-guardian.toml` | Auditor de seguridad | Completo: proposito, responsabilidades, principios, checklists, contexto PymePilot |
| `db-architect.toml` | PostgreSQL multi-tenant | Completo: schema design, RLS, migrations, indexes, contexto DB |
| `python-engine.toml` | Motor IA Python | Completo: verticales, Claude API, psycopg3, logging, costos |
| `supabase-backend.toml` | Backend Supabase | Completo: auth, Edge Functions, Storage, Realtime, JWT |
| `nextjs-dashboard.toml` | Frontend Next.js | Completo: App Router, Server Components, shadcn/ui, TypeScript |
| `api-integrations.toml` | Integraciones APIs | Completo: OAuth, REST, webhooks, circuit breaker, Contabilium |

**Formato:** Cada TOML incluye el role completo (no resumido) con toda la informacion del agente `.md` equivalente, adaptado al formato TOML de Codex.

**Codex auto-invoca** el agente apropiado segun la tarea — no requiere invocacion manual.

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `.codex/config.toml` | Reescrito: 49 allows -> 19 denys + 13 allows + defaultMode |
| `AGENTS.md` | Nueva seccion: WORKTREES — AISLAMIENTO PROACTIVO |
| `.codex/agents/security-guardian.toml` | Nuevo |
| `.codex/agents/db-architect.toml` | Nuevo |
| `.codex/agents/python-engine.toml` | Nuevo |
| `.codex/agents/supabase-backend.toml` | Nuevo |
| `.codex/agents/nextjs-dashboard.toml` | Nuevo |
| `.codex/agents/api-integrations.toml` | Nuevo |

---

## Decisiones de Diseno

1. **Denylist > Allowlist:** El riesgo real esta en operaciones irreversibles (borrar, forzar push, tumbar containers), no en editar codigo (reversible con git).

2. **acceptEdits como default:** Auto-acepta ediciones de archivos. Bash sigue pidiendo permiso la primera vez que se usa un comando nuevo, pero con el patron amplio ya no interrumpe constantemente.

3. **TOMLs completos, no resumidos:** Pato pidio explicitamente que los agentes de Codex tengan el mismo nivel de detalle que los de Codex. El `role` incluye proposito, responsabilidades, principios, checklists, y contexto especifico de PymePilot.

4. **Worktree proactivo en AGENTS.md:** La IA debe decidir por su cuenta cuando usar worktree, sin esperar que Pato lo pida. Los 6 escenarios estan documentados como regla obligatoria.

---

## Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|--------|-----------|
| Denylist incompleta | AGENTS.md tiene reglas adicionales (confirmar antes de DROP/TRUNCATE, operaciones de alto riesgo). Git como red de seguridad para archivos. |
| Agentes TOML desactualizados vs .md | Son archivos separados por herramienta. Cuando se actualice un agente en Codex, actualizar el TOML correspondiente. |
| AGENTS.md crece demasiado | La seccion de worktrees agrega ~30 lineas. Monitorear tamanio total (limite ~32KB). |
