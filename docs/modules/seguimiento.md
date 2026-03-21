# Módulo — Seguimiento

**Estado:** En producción
**Código:** `backend/engine/seguimiento/`
**Prompts:** `backend/config/prompts/seguimiento/`

## Qué resuelve

Detecta oportunidades de contacto y genera acciones comerciales sobre la
base de compras, inactividad y patrones de recompra.

## Verticales incluidas hoy

- `reposicion`
- `activacion`
- `recuperacion`
- `cross_sell`

## Qué ve el usuario

Este módulo alimenta la mayor parte del dashboard comercial actual:

- Inicio
- Pipeline
- Cuentas Clave
- Mis ventas
- parte del flujo de Métricas y Datos

## Nota de arquitectura

`seguimiento` es el primer módulo formal de PymePilot. El objetivo es que
los próximos módulos (`cotizaciones`, `portal`) se integren como pares,
sin reestructurar nuevamente el backend.
