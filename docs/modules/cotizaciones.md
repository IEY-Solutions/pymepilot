# Módulo — Cotizaciones

**Estado:** En diseño
**Código futuro:** `backend/engine/cotizaciones/`
**Prompts futuros:** `backend/config/prompts/cotizaciones/`

## Qué debería resolver

Automatizar la preparación y seguimiento de cotizaciones dentro del flujo
comercial de PymePilot para segmentos donde esa necesidad exista.

## Encaje esperado en el producto

- En `PymePilot Mayoristas` aparecerá como módulo desbloqueable por plan.
- A futuro puede existir una variante adaptada para otros segmentos.

## Regla de implementación futura

Mientras no exista una diferencia real entre segmentos, la lógica base
debe vivir en el módulo. Las variaciones comerciales o de lenguaje deben
resolverse por configuración del producto/segmento.
