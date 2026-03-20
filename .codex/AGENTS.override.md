# Instrucciones adicionales para Codex

## Uso autonomo de agentes especializados

Elegir autonomamente el agente adecuado de `.codex/agents/` como marco
de trabajo segun la tarea, y avisar al usuario cual se uso al final.
No es necesario pedir permiso para elegir un agente — si es necesario
spawnear un sub-agente real (delegacion), avisar antes de hacerlo.

## Metodologia libre con barandas

La proteccion dura de comandos vive en la configuracion global de Codex
(`~/.codex/config.toml` + `~/.codex/rules/default.rules`). No duplicar
esas restricciones como si fueran enforcement en este archivo.

Trabajar con libertad en ediciones normales de codigo y docs, pero
mantener estas reglas operativas:

- Usar worktrees de forma proactiva cuando la tarea toque 3+ archivos en
  modulos distintos, incluya migraciones, docker, cambios experimentales,
  o trabajo paralelo.
- No intentar rodear una regla global con wrappers, shell tricks, o
  variantes del mismo comando.
- Si una tarea legitima requiere una operacion bloqueada, explicarle al
  usuario por que la baranda existe, que riesgo evita, y pedir una
  instruccion explicita antes de proponer una alternativa manual.
