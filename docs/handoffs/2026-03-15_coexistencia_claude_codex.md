# Handoff — Sesion 2026-03-15: Coexistencia Claude Code + Codex

## Resumen de sesion

Pato quiere trabajar en paralelo con **Claude Code y Codex** sobre el mismo proyecto PymePilot. No es migracion, es coexistencia: ambas IAs deben tener el maximo contexto disponible en cada sesion.

### Investigacion realizada

- Se investigo la estructura de configuracion de Codex (AGENTS.md, .agents/skills/, config.toml, memoria automatica)
- Se mapeo equivalencias entre ambas herramientas

| Concepto | Claude Code | Codex |
|----------|-------------|-------|
| Instrucciones proyecto | `CLAUDE.md` | `AGENTS.md` |
| Skills/commands | `.claude/commands/*.md` (30 archivos) | `.agents/skills/*/SKILL.md` |
| Agentes especializados | `.claude/agents/*.md` (6 archivos) | No tiene equivalente directo (se convierten a skills) |
| Memoria cross-session | `~/.claude/.../memory/MEMORY.md` (manual) | `~/.codex/memories/MEMORY.md` (automatica) |
| MCP servers | settings.local.json | config.toml |
| Permisos | settings.local.json | config.toml |

### Brainstorming — 3 enfoques evaluados

1. **Enfoque A — Symlink (APROBADO por Pato):** `AGENTS.md` es symlink a `CLAUDE.md`. Cero mantenimiento, cero drift.
2. **Enfoque B — Archivo compartido + wrappers:** Tres archivos a mantener. Descartado por complejidad.
3. **Enfoque C — Reestructura completa con .ai/:** Sobre-ingenieria. Descartado.

### Diseno aprobado — Enfoque A

**Estructura final:**
```
pymepilot/
├── CLAUDE.md                          # Fuente de verdad (ya existe)
├── AGENTS.md → CLAUDE.md             # Symlink para Codex
├── docs/
│   └── PROJECT_STATE.md              # Estado compartido entre IAs
├── .claude/                           # Solo Claude Code (no se toca)
│   ├── agents/                        #   6 agentes
│   ├── commands/                      #   30 skills
│   ├── agent-memory/                  #   Historial de auditorias
│   └── settings.local.json
├── .agents/                           # Solo Codex
│   └── skills/                        #   36 skills (30 + 6 agentes convertidos)
└── .codex/
    └── config.toml                    #   MCP servers + permisos
```

**Decisiones clave:**
- `AGENTS.md` es symlink a `CLAUDE.md` (mismo archivo, dos lectores)
- `docs/PROJECT_STATE.md` nuevo: estado del proyecto compartido que ambas IAs leen y actualizan
- Las 30 skills de `.claude/commands/` se convierten al formato `.agents/skills/*/SKILL.md`
- Los 6 agentes se convierten a skills de Codex (no tiene subprocesos, pero puede cargar instrucciones)
- Context7 MCP se configura en `.codex/config.toml`
- Memoria privada de cada IA: no se comparte (cada una mantiene la suya)

**Limite tecnico:** Codex tiene limite de 32 KB para AGENTS.md — verificar que CLAUDE.md entre.

## Estado

- Brainstorming: COMPLETADO
- Diseno: APROBADO por Pato
- Implementacion: PENDIENTE

## Proximos pasos (implementacion)

1. Verificar que CLAUDE.md entra en 32 KB
2. Crear symlink `AGENTS.md → CLAUDE.md`
3. Crear `docs/PROJECT_STATE.md` con estado actual
4. Convertir 36 skills+agentes al formato `.agents/skills/`
5. Crear `.codex/config.toml` con Context7
6. Agregar instruccion en CLAUDE.md para leer/actualizar `PROJECT_STATE.md`
7. Commit y testear con ambas IAs

## Archivos tocados

- Ninguno (sesion de brainstorming/diseno solamente)

## Archivos de referencia

- Este handoff: `docs/handoffs/2026-03-15_coexistencia_claude_codex.md`
- CLAUDE.md actual: 650 lineas, ~25 KB estimado
- Inventario de archivos Claude Code: 70 archivos, ~25,000+ lineas
