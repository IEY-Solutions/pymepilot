# Handoff: Reestructuración Multi-Módulo

**Fecha:** 2026-03-21
**Commit:** c7800a1
**Estado:** Completo. Listo para verificar y continuar.

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

**⚠️ PENDIENTE APLICAR EN DB DE PRODUCCIÓN:**
```bash
docker cp database/migrations/057_platform_modules.sql orion-menteax_postgres:/tmp/
docker exec orion-menteax_postgres psql -U postgres -d orion_db -f /tmp/057_platform_modules.sql
```

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
- El frontend (el sidebar dinámico se construye como parte del módulo 2, no ahora)
- Los prompts en `backend/config/prompts/` (sin cambios, el path sigue resolviendo igual)

---

## Qué verificar

1. **Migración 057 aplicada** — ver comando arriba. Sin esto, `active_modules` y `segment` no existen en la DB.
2. **Orquestador funciona** — `python backend/main.py --dry-run --tenant-slug iey` debe correr sin errores.
3. **Sin referencias viejas** — `grep -r "engine.verticales" backend/ --include="*.py"` debe dar vacío.

---

## Próximos pasos

1. Aplicar migración 057 en DB de producción
2. Diseñar módulo 2: Cotizaciones Automáticas (PRD en `docs/products/`)
3. Diseñar módulo 3: Portal de Pedidos (PRD en `docs/products/`)
4. Implementar sidebar dinámico en frontend que lea `active_modules`
