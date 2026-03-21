# Diseño — Estructura Modular con Evolución por Segmentos

**Fecha:** 2026-03-21
**Estado:** Aprobado para ejecución mínima

## Decisión tomada

PymePilot se comercializa como tres productos distintos:

- `PymePilot Mayoristas`
- `PymePilot Servicios`
- `PymePilot Minoristas`

Pero el código, por ahora, no se separa por segmento. La estructura actual
debe crecer primero por módulos reutilizables y recién sumar una capa
explícita de `products/` cuando exista un segundo segmento real con
diferencias comprobadas.

## Qué se implementa ahora

### Backend

- Se mantiene `backend/engine/` como raíz técnica.
- Los módulos viven como subdirectorios de `engine/`.
- `seguimiento` queda como primer módulo formal.
- Los prompts se ordenan por módulo en `backend/config/prompts/<modulo>/`.

### Frontend

- La navegación deja de estar hardcodeada en componentes visuales.
- Se introduce una capa liviana de configuración de producto:
  `frontend/src/lib/products/`.
- Por ahora el producto activo es `mayoristas`, con módulos por defecto
  `['seguimiento']`.

### Documentación

- `docs/products/` documenta la oferta comercial por segmento.
- `docs/modules/` documenta las capacidades reutilizables del sistema.

## Qué NO se implementa ahora

- No se crea `backend/products/`.
- No se crea `frontend/src/products/` como capa grande.
- No se renombra `backend/engine/` a `platform/`.
- No se agregan carpetas vacías para segmentos o módulos todavía no
  construidos.

## Señales que habilitan la siguiente etapa

La capa `products/` en código debe agregarse recién cuando exista un
segundo segmento real (`servicios` o `minoristas`) con al menos 2 o 3
diferencias concretas como:

- navegación distinta
- reglas de negocio distintas
- prompts o copy distintos
- módulos distintos
- onboarding distinto

## Estructura objetivo de mediano plazo

### Estado actual recomendado

```text
backend/
  engine/
    seguimiento/
    cotizaciones/
    portal/
    connectors/
    claude/
    db/
    core/
```

```text
frontend/src/
  app/
  components/
  lib/products/
  modules/
```

### Estado futuro cuando exista un segundo segmento real

```text
backend/
  engine/
    seguimiento/
    cotizaciones/
    portal/
    connectors/
    claude/
    db/
    core/
  products/
    mayoristas/
    servicios/
    minoristas/
```

```text
frontend/src/
  app/
  components/
  modules/
  products/
    mayoristas/
    servicios/
    minoristas/
```

## Regla operativa para futuras sesiones

Si aparece trabajo para `servicios` o `minoristas`, primero responder:

1. ¿La diferencia es solo de copy/configuración?
2. ¿La diferencia es de reglas de negocio?
3. ¿La diferencia justifica una capa `products/` en código?

Si la respuesta a 3 es “todavía no”, reutilizar módulos existentes y
resolverlo por configuración/documentación. Si la respuesta es “sí”, abrir
la migración estructural agregando `products/` como capa nueva sin mover
violentamente la base actual.
