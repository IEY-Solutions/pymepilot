# Pack de reconstruccion de PymePilot

Este directorio condensa el contexto minimo necesario para rehacer el
proyecto en un repo nuevo sin copiar el desorden historico del actual.
La regla es simple: primero entender el sistema, despues copiar solo
las decisiones que siguen siendo validas.

## Orden de lectura

1. [AGENTS.md](../../AGENTS.md)
2. [docs/PROJECT_STATE.md](../PROJECT_STATE.md)
3. [legacy-repo.toml](./legacy-repo.toml)
4. [file-index.md](./file-index.md)
5. [legacy-map.md](./legacy-map.md)
6. [packets/backend.md](./packets/backend.md)
7. [packets/database.md](./packets/database.md)
8. [packets/frontend.md](./packets/frontend.md)
9. [packets/operations.md](./packets/operations.md)
10. [system-map.md](./system-map.md)
11. [contracts.md](./contracts.md)
12. [business-modules.md](./business-modules.md)
13. [operations.md](./operations.md)
14. [database.md](./database.md)
15. [decisions-debt.md](./decisions-debt.md)

## Fuentes de verdad

- [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
- [docs/ROADMAP.md](../ROADMAP.md)
- [docs/ONBOARDING.md](../ONBOARDING.md)
- [docs/MODEL_ROUTING.md](../MODEL_ROUTING.md)
- [docs/CONTABILIUM_API.md](../CONTABILIUM_API.md)
- [docs/modules/](../modules)
- [docs/products/](../products)

## What this pack enables

- A new repo can keep the legacy repo open as a live reference.
- Codex can resolve which files to read first without guessing.
- Backend contracts are documented before frontend surfaces.
- The migration path is explicit: what to copy, what to refactor, what to
  split, and what to defer.

## Invariantes que no se negocian

- El backend orquesta, el frontend presenta y la DB guarda el estado.
- El flujo sano siempre es: sync -> atribucion -> verticales -> push.
- El aislamiento por tenant se mantiene en DB y en el contexto de sesion.
- Las integraciones ERP son de solo lectura.
- Codex es el unico agente operativo; Claude solo sigue siendo valido
  cuando se refiere al producto o a la API de Anthropic.

## Que copiar al reconstruir

- Contratos tecnicos estables.
- Estructura de modulos y puntos de entrada.
- Reglas de onboarding, operacion y monitoreo.
- Esquema y patrones de migracion.
- Decisiones que ya demostraron valor en produccion.

## Que no copiar

- Wrappers historicos de Claude Code.
- Handoffs viejos que solo describen el camino, no la regla final.
- Duplicacion de prompts o reglas que ya quedaron centralizadas.
- Layouts de carpeta que existieron por conveniencia y no por contrato.
