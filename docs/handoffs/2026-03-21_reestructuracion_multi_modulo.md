# Handoff: Reestructuración Multi-Módulo

**Fecha:** 2026-03-21
**Commit:** c7800a1
**Estado:** Verificado y ejecutado.

---

## Qué se hizo y por qué

PymePilot dejó de ser un solo producto y se convirtió en una plataforma
multi-módulo que escala de mayoristas a minoristas. Esta reestructuración
prepara el proyecto para que los módulos nuevos (cotizaciones, portal de
pedidos) encajen limpiamente sin tocar lo que ya funciona.

---

## Cambios aplicados

### 1. Renombrado backend/engine/verticales/ → backend/engine/seguimiento/

**Por qué:** "verticales" era el nombre técnico del patrón de diseño.
"seguimiento" es el nombre del módulo de negocio. Los próximos módulos
se llamarán "cotizaciones" y "portal" — necesitaban un compañero coherente.

**Archivos renombrados (mismo contenido, nueva ruta):**
```
backend/engine/seguimiento/__init__.py   (ex verticales/__init__.py)
backend/engine/seguimiento/base.py
backend/engine/seguimiento/reposicion.py
backend/engine/seguimiento/activacion.py
backend/engine/seguimiento/recuperacion.py
backend/engine/seguimiento/cross_sell.py
```

**Imports actualizados en:**
- `backend/main.py` línea 80
- `backend/scripts/run_vertical.py` línea 56
- Los 4 archivos de verticales (import de VerticalBase)
- `backend/engine/seguimiento/__init__.py` (VERTICAL_REGISTRY paths)

**Verificado:** `from backend.engine.seguimiento import VERTICAL_REGISTRY` → OK

### 2. Migración 057 — Columnas segment y active_modules en tenants

**Archivo:** `database/migrations/057_platform_modules.sql`
**Rollback:** `database/migrations/057_rollback.sql`

**Estado real al cierre:** aplicada en DB de producción el 2026-03-21.

**Detalle importante:** la versión inicial falló porque PostgreSQL no
soporta `ADD CONSTRAINT IF NOT EXISTS`. La migración fue corregida con un
patrón idempotente usando `pg_constraint` y luego reaplicada exitosamente.

**Verificado en producción:**
- columnas `segment` y `active_modules` existen en `public.tenants`
- tenant activo `iey` quedó con `segment = 'mayorista'`
- tenant activo `iey` quedó con `active_modules = {'seguimiento'}`
- constraints `tenants_segment_check` y
  `tenants_active_modules_not_empty` existen

**Qué agrega:**
- `segment TEXT DEFAULT 'mayorista'` — a qué mercado pertenece el tenant
- `active_modules TEXT[] DEFAULT ARRAY['seguimiento']` — módulos habilitados

**Para qué sirve:** el frontend leerá `active_modules` para construir el
sidebar dinámicamente. Solo se muestran las páginas de los módulos activos.

### 3. Documentación actualizada

| Archivo | Qué cambió |
|---------|-----------|
| `docs/PRD.md` | Visión: de "BI para distribuidores" a "seguimiento pre/post venta + fidelización". Core Engine. Canal WhatsApp como core. |
| `docs/ROADMAP.md` | Post-MVP: 4 Pilares (Webhooks → Multi-Agente → Embedded Signup), escalera de mercado |
| `docs/ARCHITECTURE.md` | Visión general + diagrama con WhatsApp + tabla 4 Pilares |
| `docs/PROJECT_STATE.md` | Descripción del proyecto + escalera de mercado + 4 Pilares |
| `docs/products/mayoristas.md` | **Nuevo.** Spec completo del producto mayorista B2B |

### 4. Actualización posterior — estructura mínima implementada

Después de la verificación inicial se aplicaron mejoras mínimas para que
el proyecto quede listo para crecer por módulos sin reestructurar otra vez:

- `backend/config/prompts/seguimiento/` ahora agrupa los 4 prompts del
  módulo `seguimiento`
- `backend/engine/seguimiento/base.py` busca primero prompts namespaced
  por módulo y tiene fallback a la ruta legacy
- `frontend/src/lib/products/` centraliza la configuración del producto
  actual (`PymePilot Mayoristas`)
- `frontend/src/components/layout/sidebar.tsx` y `bottom-nav.tsx`
  renderizan navegación desde esa configuración, no desde arrays hardcodeados
- `docs/modules/` documenta `seguimiento`, `cotizaciones` y `portal`
- el mini-roadmap operativo de `cotizaciones` + `portal` quedó registrado
  como tarea en Notion, no en el repo:
  `Roadmap modular — cotizaciones y portal`
  `https://www.notion.so/32a63ade414e81bca4efd03c624b15a4`

### 5. Bug encontrado durante la verificación

El dry-run del orquestador expuso un bug en atribución:

- error: `psycopg.errors.IndeterminateDatatype`
- causa raíz: `jsonb_build_object()` con parámetros sin cast explícito
  bajo `psycopg 3`
- fix aplicado en `backend/engine/db/queries.py`
- cobertura agregada en `backend/tests/test_db_queries.py`

---

## Arquitectura de módulos (cómo funciona)

Cada tenant en la DB tiene:
```
segment:        'mayorista'
active_modules: ['seguimiento']     ← hoy
                ['seguimiento', 'cotizaciones']  ← cuando se active módulo 2
```

El sidebar del frontend debe leer `active_modules` del tenant al hacer
login y mostrar solo las secciones correspondientes.

Cuando se construya el módulo 2, el código irá en:
```
backend/engine/cotizaciones/        ← nuevo módulo
backend/config/prompts/cotizaciones/ ← prompts del módulo
```

Y se agrega al tenant así:
```sql
UPDATE public.tenants
SET active_modules = array_append(active_modules, 'cotizaciones')
WHERE slug = 'iey';
```

---

## Lo que NO cambió

- Lógica interna de las verticales (reposicion, activacion, recuperacion, cross_sell)
- La tabla `tenants.active_verticals` (sigue controlando qué verticales corren en el orquestador)
- El orquestador `backend/main.py` (funciona igual, solo cambió 1 import)
- El frontend todavía NO lee `active_modules` reales desde la DB del tenant
- No existen todavía `backend/engine/cotizaciones/` ni `backend/engine/portal/`
- No existe todavía una capa `backend/products/` en código

---

## Qué quedó verificado

1. **Migración 057 aplicada** — OK, con columnas y constraints presentes en producción.
2. **Sin referencias viejas** — `grep -r "engine.verticales" backend/ --include="*.py"` dio vacío.
3. **Orquestador/imports** — el flujo real pasó por `backend.engine.seguimiento`
   y el bug de atribución encontrado fue corregido.
4. **Prompts de seguimiento** — cargan desde `backend/config/prompts/seguimiento/`
   con fallback legacy probado por test.
5. **Frontend producto actual** — navegación extraída a `frontend/src/lib/products/`
   representando `PymePilot Mayoristas`.

---

## Próximos pasos

1. Diseñar módulo 2: Cotizaciones Automáticas (PRD en `docs/products/`)
2. Crear `backend/engine/cotizaciones/`
3. Crear prompts en `backend/config/prompts/cotizaciones/`
4. Implementar lectura real de `active_modules` en frontend y backend
5. Diseñar módulo 3: Portal de Pedidos
