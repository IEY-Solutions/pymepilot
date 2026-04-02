# Decisiones y deuda

## Decisiones que se conservan

- `seguimiento` es el modulo productivo central.
- El backend coordina, no decide desde la UI.
- Las integraciones ERP son de solo lectura.
- El onboarding debe ser idempotente.
- Codex es la unica herramienta operativa de edicion y analisis.

## Decisiones que no conviene repetir

- Duplicar estructura por agente o por tool viejo.
- Copiar handoffs como si fueran especificacion final.
- Separar verticales en repositorios distintos sin necesidad real.
- Dispersar prompts, routing y contratos por varios lugares.

## Deuda que si vale documentar

- WhatsApp Cloud API sigue siendo un punto externo sensible.
- La expansion a `cotizaciones` y `portal` sigue pendiente de producto.
- Algunas rutas historicas siguen existiendo solo como contexto, no como
  comportamiento deseado para la reconstruccion.

## Principio para el repo nuevo

Si una pieza no explica un contrato, no debe ser parte del pack de
reconstruccion.
