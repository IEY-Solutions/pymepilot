# Handoff — Backlog Features Fase 10 (Sesiones 1-2)

**Fecha:** 2026-03-10
**Ultima actualizacion:** Sesion 2 (continuacion de contexto)
**Estado:** Feature 1 COMPLETA, Feature 2 BLOQUEADA en theming dinamico

---

## Completado en esta sesion

### Feature 1: Reestructurar Secciones — DONE + DEPLOYED

1. **Backend (Sesion 1):** Motor Python crea pipeline_cards atomicamente
   con la prediccion (commit `1b94782`)
   - Nueva funcion `create_pipeline_card()` en `queries.py`
   - Llamada desde `base.py` despues de `save_prediction()`, mismo commit
   - ON CONFLICT DO NOTHING para idempotencia
   - Guard `if not dry_run` para no crear cards en testing

2. **Frontend (Sesion 2):** Pipeline absorbe todo (commit `74e1dd8`)
   - Eliminadas paginas `/contactar` y `/historial`
   - Modal del Pipeline: mensaje editable (textarea) + boton WhatsApp
     en stage "a_contactar"
   - Navegacion: de 8 a 6 items
   - Limpieza: 830 lineas eliminadas, componentes predictions/ borrados
     (excepto vertical-filter.tsx usado por /logros)

### Feature 2: Personalizacion — PARCIALMENTE COMPLETA

1. **Migracion DB (commit `50a5ec6`):** — DONE
   - `branding_config` JSONB en tabla `tenants`
   - RLS habilitado en tenants (SELECT flexible + UPDATE restringido)
   - GRANT SELECT/UPDATE a rol `authenticated`
   - **CRITICO:** Migracion aplicada en `orion_db` (no `postgres`)

2. **Pagina /configuracion (commit `50a5ec6`):** — DONE, FUNCIONAL
   - Upload logo como base64 (max 500KB)
   - Color picker (12 presets + custom hex + input type=color)
   - Preview en vivo del header
   - Guardar funciona correctamente (fix grant en commit `6e7c80c`)

3. **Footer "Powered by PymePilot" (commit `50a5ec6`):** — DONE

4. **Theming dinamico — BLOQUEADO**
   El color elegido se guarda y se lee correctamente, pero NO se aplica
   visualmente a todo el dashboard. Solo cambia el header.

---

## Problema actual: Theming dinamico no funciona

### Que se intento

**Intento 1: `@theme inline` con CSS variables indirectas (commit `de175ff`)**
```css
@theme inline {
  --color-brand-50: var(--brand-50, #eff6ff);
  ...
}
```
BrandingProvider seteaba `--brand-50`, `--brand-100`, etc.

**Resultado:** No funciono. `@theme inline` incrusta los valores al compilar,
asi que las variables en runtime no tienen efecto sobre las clases CSS.

**Intento 2: `@theme` (sin inline) con `--color-brand-*` directo (commit `aa2d09a`)**
```css
@theme {
  --color-brand-50: #eff6ff;
  ...
}
```
BrandingProvider setea `--color-brand-50`, etc. directamente en `document.documentElement`.

**Resultado:** Tampoco funciono. El color sigue sin aplicarse mas alla del header.

### Diagnostico — Sesion 2 (hallazgos clave)

**HALLAZGO CONFIRMADO:** El CSS compilado en produccion SÍ usa `var()`:
```css
/* Archivo: /app/.next/static/chunks/6c7d53e141747e71.css */
.bg-brand-600{background-color:var(--color-brand-600)}
.text-brand-700{color:var(--color-brand-700)}
/* etc — TODAS las clases brand-* referencian var() */
```

Las variables se declaran en `@layer theme{:root,:host{--color-brand-600:#2563eb ...}}`.

**POR QUE NO FUNCIONABA:**
El intento 2 usaba `document.documentElement.style.setProperty()` (inline styles).
En teoria, inline styles tienen mayor prioridad que `@layer theme`. Sin embargo,
hay un edge case con CSS cascade layers + custom properties que impide que
inline `setProperty` sobreescriba variables declaradas dentro de `@layer`.

**INTENTO 3 (commit `1aa8fbe`, NO deployado aun):**
Cambio de enfoque: en vez de `style.setProperty()` en el elemento `<html>`,
inyectar un `<style id="brand-theme-override">` en el `<head>` con:
```css
:root { --color-brand-50: #xxx; --color-brand-100: #yyy; ... }
```
Esta regla `:root` esta FUERA de cualquier `@layer`, lo cual le da mayor
prioridad que la declaracion dentro de `@layer theme` segun el CSS cascade spec.

**ESTADO: NO VERIFICADO** — El commit existe pero NO fue deployado.
La proxima sesion debe:
1. Deployar el commit `1aa8fbe`
2. Probar cambiar color en /configuracion
3. Si funciona → Feature 2 COMPLETA
4. Si no funciona → debuggear con DevTools (ver abajo)

### Si el intento 3 tampoco funciona — Plan B

**Debuggear con DevTools del browser:**
1. Elementos → seleccionar un boton con clase `bg-brand-600` → ver que regla CSS aplica
2. Verificar si `<style id="brand-theme-override">` existe en el `<head>`
3. Verificar si las variables en ese `<style>` tienen el color correcto
4. Verificar si hay otro `<style>` o regla que las sobreescriba

**Alternativa nuclear (garantizada):**
Abandonar CSS custom properties. Crear componente `<BrandedElement>` que
aplique colores via inline `style={{}}` usando el hook `useBranding()`.
Esto es menos elegante pero 100% funcional.

**Alternativa intermedia:**
Usar `!important` en el `<style>` inyectado:
```css
:root { --color-brand-600: #xxx !important; }
```

---

## Archivos relevantes

| Archivo | Estado |
|---------|--------|
| `frontend/src/app/globals.css` | `@theme` con defaults brand-50 a brand-900 |
| `frontend/src/contexts/branding-context.tsx` | Genera paleta HSL + setea `--color-brand-*` |
| `frontend/src/app/(dashboard)/configuracion/page.tsx` | Funcional, guarda OK |
| `frontend/src/components/layout/header.tsx` | Usa `useBranding()` + inline style (FUNCIONA) |
| `frontend/src/components/layout/footer.tsx` | "Powered by PymePilot" (FUNCIONA) |
| `frontend/src/components/layout/sidebar.tsx` | Usa `brand-*` classes (NO FUNCIONA) |
| `frontend/src/components/layout/bottom-nav.tsx` | Usa `brand-*` classes (NO FUNCIONA) |
| `database/migrations/046_tenant_branding.sql` | Aplicada en orion_db |
| `docs/plans/2026-03-10-backlog-features-fase10-design.md` | Design doc aprobado |
| `docs/plans/2026-03-10-backlog-implementacion-plan.md` | Plan de 6 sesiones |

## Commits de esta sesion

```
1b94782 feat: predicciones crean pipeline cards directo (sin sync RPC)
74e1dd8 feat: reestructurar secciones — Pipeline absorbe Contactar e Historial
50a5ec6 feat: personalizacion por tenant — logo, color, /configuracion, footer
6e7c80c fix: grant SELECT/UPDATE on tenants to authenticated role
de175ff feat: theming completo — color de marca se aplica a todo el dashboard
aa2d09a fix: theming dinamico — usar @theme (no inline) + --color-brand-*
1aa8fbe fix: theming dinamico — inyectar <style> tag en vez de inline setProperty  ← NO DEPLOYADO
```

## 20+ componentes ya actualizados de blue-* a brand-*

Todos los azules de marca fueron reemplazados por `brand-*` en:
sidebar, bottom-nav, contact-modal, pipeline-column, pipeline-card,
chat-bubble, chat-input, chat-message, chat-panel, push-banner,
erp-status-card, file-upload, drive-connection, page (home),
datos/page, configuracion/page, asesor/page, logros-content,
metricas-content, login/page.

Los azules de vertical (reposicion = blue) se mantuvieron intactos.

## Proximos pasos (proxima sesion)

1. **DEPLOYAR** commit `1aa8fbe` (intento 3 del theming) y probar
2. **Si funciona:** Feature 2 COMPLETA, avanzar a sesion 4
3. **Si no funciona:** debuggear con DevTools o pivotar a Plan B (inline styles)
4. **Sesion 4:** Aplicar paleta PymePilot (requiere URL del sitio web de Pato)
5. **Sesiones 5-6:** Feature 3 — Proyeccion de stock (independiente)

## Estado de navegacion actual

7 items: Inicio, Pipeline, Metricas, Mis Ventas, Datos, Asesor IA, Configuracion
