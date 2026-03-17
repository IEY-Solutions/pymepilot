# Handoff — Sesion 2026-03-17: Implementacion Coexistencia Claude Code + Codex

## Resumen de sesion

Se implemento el diseño aprobado en la sesion 2026-03-15 para que Claude Code
y Codex puedan trabajar en paralelo sobre el mismo proyecto PymePilot.

## Cambios realizados

### 1. CLAUDE.md reducido a < 32 KB (limite Codex)
- **Antes:** 36,620 bytes (excedia limite)
- **Despues:** 32,347 bytes (margen: 421 bytes)
- **Como:** Se extrajeron 14 bloques "Origen" (contexto historico de cada regla)
  a `docs/CLAUDE_ORIGINS.md` (5,793 bytes). Las reglas operativas quedan intactas.
- Se agrego referencia: "Contexto historico de cada regla en `docs/CLAUDE_ORIGINS.md`"

### 2. AGENTS.md (symlink)
- Ya existia de la sesion anterior: `AGENTS.md → CLAUDE.md`
- Verificado que funciona correctamente (mismo tamaño)

### 3. docs/PROJECT_STATE.md (nuevo)
- Archivo compartido de estado del proyecto que ambas IAs leen y actualizan
- Contiene: fases completadas, features en curso, bloqueantes, backlog, stack, arquitectura
- Se agrego instruccion en CLAUDE.md para que ambas IAs lo lean al inicio y actualicen al final

### 4. Skills convertidas a formato Codex
- 36 commands de `.claude/commands/` + 6 agentes de `.claude/agents/`
- Convertidas a `.agents/skills/nombre/SKILL.md` (formato Codex)
- Conversion automatizada: se removio frontmatter YAML y seccion "Persistent Agent Memory"
- Total: 42 skills nuevas en `.agents/skills/`

### 5. .codex/config.toml (nuevo)
- Configuracion de Codex con Context7 MCP server
- Modelo default: o4-mini
- Modo approval: suggest

### 6. Instruccion PROJECT_STATE en CLAUDE.md
- Regla agregada: leer `docs/PROJECT_STATE.md` al iniciar sesion,
  actualizarlo al finalizar si hubo cambios relevantes

## Archivos nuevos
- `docs/CLAUDE_ORIGINS.md` — Contexto historico extraido de CLAUDE.md
- `docs/PROJECT_STATE.md` — Estado compartido entre IAs
- `.codex/config.toml` — Configuracion Codex
- `.agents/skills/*/SKILL.md` — 42 skills convertidas
- `docs/handoffs/2026-03-17_coexistencia_implementacion.md` — Este handoff

## Archivos modificados
- `CLAUDE.md` — Reducido (origenes extraidos) + instruccion PROJECT_STATE

## Archivos NO tocados
- `.claude/commands/` — Intactos (Claude Code sigue usandolos)
- `.claude/agents/` — Intactos
- `AGENTS.md` — Symlink sin cambios

## INCERTIDUMBRE declarada
- **config.toml de Codex:** La sintaxis para MCP servers podria no ser exacta.
  Si Context7 no conecta en la primera sesion de Codex, ajustar la config.

## Verificacion para Codex (primera sesion)

Al abrir Codex por primera vez en este proyecto, verificar:

1. **AGENTS.md se lee:** Codex deberia mostrar que encontro instrucciones del proyecto
2. **Skills disponibles:** `ls .agents/skills/` deberia listar 80+ skills
3. **Context7 MCP:** Probar `resolve-library-id` con cualquier libreria
4. **PROJECT_STATE.md:** Pedirle a Codex que lea el estado del proyecto

### Prompt sugerido para primera sesion Codex:
```
Lee AGENTS.md y docs/PROJECT_STATE.md para entender el contexto del proyecto.
Despues decime: que entendiste sobre PymePilot, que reglas de seguridad
aplican, y confirma que tenes acceso a Context7 MCP.
```

## Proximos pasos
- Testear Codex con el prompt sugerido arriba
- Si config.toml no funciona, ajustar formato
- Empezar a usar ambas IAs en paralelo para tareas independientes
