# Plan de Implementacion — Backlog Features Fase 10

**Fecha:** 2026-03-10
**Design doc:** `2026-03-10-backlog-features-fase10-design.md`
**Sesiones estimadas:** 5-6 sesiones (1-2 hs c/u)

---

## Feature 1: Reestructurar Secciones (Sesiones 1-2)

### Sesion 1 — Backend: predicciones directo al Pipeline

**Objetivo:** Que el motor Python cree pipeline_cards en vez de predictions.

#### Paso 1: Adaptar el motor Python
- Modificar `backend/engine/verticales/base.py` → `save_results()`
- En vez de INSERT en `predictions`, crear directamente `pipeline_cards`
  con stage = 'a_contactar'
- El mensaje de Claude va en `stage_messages` JSONB (key: 'a_contactar')
- Mantener metadata (vertical, confidence, priority)

#### Paso 2: Migrar tabla pipeline_cards (si hace falta)
- Verificar que `pipeline_cards` tenga todos los campos necesarios
  que hoy viven en `predictions` (confidence_score, priority, vertical, etc.)
- Crear migracion si faltan campos + rollback

#### Paso 3: Adaptar queries.py
- `save_prediction()` → `save_pipeline_card()` o adaptar para insertar
  en pipeline_cards
- Verificar que el RPC `sync_predictions_to_pipeline` se pueda deprecar

#### Paso 4: Testing
- Correr `run_vertical.py --dry-run` para verificar flujo
- Verificar que las cards aparezcan en el Pipeline

---

### Sesion 2 — Frontend: eliminar paginas + modal editable

**Objetivo:** Limpiar navegacion y agregar edicion de mensaje en el modal.

#### Paso 1: Modal con mensaje editable
- En `frontend/src/components/pipeline/contact-modal.tsx`
- Stage 'a_contactar': agregar textarea editable con el mensaje
- Agregar boton WhatsApp (copiar + abrir wa.me) — mover logica
  desde `predictions/whatsapp-button.tsx`
- El vendedor puede editar el texto antes de copiar

#### Paso 2: Eliminar paginas
- Eliminar `frontend/src/app/(dashboard)/contactar/` (carpeta completa)
- Eliminar `frontend/src/app/(dashboard)/historial/` (carpeta completa)

#### Paso 3: Limpiar componentes predictions
- Revisar `frontend/src/components/predictions/`
- Mantener solo lo que se reutilice (ej: copy-button.tsx si se usa en otro lado)
- Eliminar prediction-card.tsx, prediction-actions.tsx, vertical-filter.tsx,
  whatsapp-button.tsx si ya no se usan en ningun lado

#### Paso 4: Actualizar navegacion
- `frontend/src/components/layout/sidebar.tsx` — quitar Contactar e Historial
- `frontend/src/components/layout/bottom-nav.tsx` — idem
- Verificar que no queden links rotos en otros componentes

#### Paso 5: Actualizar chatbot tools (si referencian /contactar)
- Revisar `frontend/src/lib/chat/tools.ts` por referencias a predictions
- Adaptar queries del chatbot si consultan tabla predictions

#### Paso 6: Testing manual
- Verificar Pipeline muestra cards con mensaje editable
- Verificar WhatsApp funciona desde el modal
- Verificar navegacion limpia (6 items)
- Verificar chatbot sigue funcionando

---

## Feature 2: Personalizacion + Mejora Visual (Sesiones 3-4)

### Sesion 3 — Infraestructura de theming + /configuracion

**Prerequisito:** Pato provee URL de su sitio web para extraer paleta.

#### Paso 1: Migracion DB
- ALTER TABLE tenants ADD COLUMN branding_config JSONB DEFAULT '{}'
- Estructura: `{"logo_url": null, "primary_color": "#3B82F6"}`
- Migracion + rollback
- NOTIFY pgrst para PostgREST

#### Paso 2: Storage para logos
- Crear bucket 'tenant-logos' en Supabase Storage
- RLS: cada tenant solo accede a sus archivos
- Politicas: INSERT/SELECT por tenant_id

#### Paso 3: BrandingProvider (React Context)
- Crear `frontend/src/contexts/branding-context.tsx`
- Fetch branding_config del tenant al cargar
- Exponer variables CSS dinamicas (`--color-primary`, etc.)
- Aplicar en layout.tsx

#### Paso 4: Pagina /configuracion
- Crear `frontend/src/app/(dashboard)/configuracion/page.tsx`
- Formulario: upload logo + color picker
- Server Action para guardar en tenants.branding_config
- Preview en vivo del color seleccionado

#### Paso 5: Navegacion
- Agregar "Configuracion" a sidebar y bottom-nav (icono: gear/settings)

---

### Sesion 4 — Mejora visual + Powered by PymePilot

#### Paso 1: Paleta PymePilot
- Extraer colores del sitio web de Pato
- Definir tokens: primary, secondary, accent, backgrounds, borders
- Actualizar globals.css con CSS custom properties
- Iconos modernos: evaluar lucide-react (ya incluido en shadcn)

#### Paso 2: Aplicar paleta a componentes
- Header, sidebar, bottom-nav
- KPI cards, badges de prioridad/vertical
- Botones, inputs, modales
- Charts (colores de graficos)
- Pipeline columnas

#### Paso 3: Footer "Powered by PymePilot"
- Crear componente footer con logo/texto PymePilot
- Agregarlo al layout.tsx (visible en todas las paginas)
- Estilo sutil, no invasivo

#### Paso 4: CSS variables dinamicas por tenant
- Cuando el tenant tiene primary_color, sobreescribir --color-primary
- Los componentes que usen la variable se adaptan automaticamente
- Logo del tenant reemplaza "PymePilot" en el header

#### Paso 5: Testing
- Verificar con tenant IEY (color + logo)
- Verificar sin branding (defaults PymePilot)
- Verificar responsive (mobile + desktop)
- Verificar footer en todas las paginas

---

## Feature 3: Proyeccion de Stock (Sesiones 5-6)

### Sesion 5 — Backend: queries de demanda + RPC

#### Paso 1: Nuevas queries SQL
- `get_demand_projection_global(tenant_id, days_ahead)`:
  Demanda agregada por SKU — suma de todos los clientes
  Columnas: producto, demanda_unidades, clientes_que_compran,
  frecuencia_promedio, confianza
- `get_demand_projection_top20(tenant_id, days_ahead)`:
  Top 20 clientes con detalle por producto — que va a necesitar
  cada uno, cuantas unidades, cuando

#### Paso 2: RPC en PostgreSQL
- Crear funciones RPC para que el frontend las llame via Supabase
- Reutilizar patron LAG() de queries.py (ya probado en produccion)
- Calcular score de confianza (5 factores)

#### Paso 3: Migracion
- Crear RPCs + GRANT EXECUTE al rol pymepilot_app
- Rollback
- NOTIFY pgrst

#### Paso 4: Testing SQL
- Probar con datos IEY
- Verificar que los numeros tienen sentido (sanity check)
- Verificar performance (EXPLAIN ANALYZE)

---

### Sesion 6 — Frontend: pagina /proyeccion

#### Paso 1: Pagina base
- Crear `frontend/src/app/(dashboard)/proyeccion/page.tsx`
- Server component que llama a los RPCs
- Toggle/tabs: "Vista Global" | "Top 20 Clientes"

#### Paso 2: Vista Global
- Tabla de productos con demanda estimada
- Columnas: Producto, Demanda estimada (unidades), Clientes,
  Frecuencia promedio, Confianza (badge con color)
- Ordenado por demanda (mas demandados arriba)
- Filtro de periodo: 2 semanas / 1 mes / 2 meses

#### Paso 3: Vista Top 20 Clientes
- Cards o tabla expandible por cliente
- Por cada cliente: nombre, productos que va a necesitar,
  unidades estimadas, proxima compra, ultima compra
- Patron: "Juan → 30 fundas MagSafe (est. 15 Mar), 10 cables (est. 20 Mar)"

#### Paso 4: Navegacion
- Agregar "Proyeccion" a sidebar y bottom-nav
- Icono: TrendingUp o BarChart

#### Paso 5: Tooltips
- Agregar textos explicativos al diccionario de tooltips
- Explicar que significan los scores de confianza
- Explicar que es demanda estimada vs stock real (futuro)

#### Paso 6: Export
- Export a Excel (mismo patron que metricas)

#### Paso 7: Testing
- Verificar datos con IEY
- Verificar responsive
- Verificar tooltips
- Verificar export

---

## Checklist pre-implementacion

- [ ] Pato provee URL sitio web (para Feature 2, Sesion 4)
- [ ] Backup DB antes de migraciones
- [ ] Verificar que Pipeline actual funciona correctamente (baseline)

## Notas

- Cada sesion es autocontenida — se puede commitear y deployar
- Feature 1 cambia la navegacion base, debe ir primero
- Feature 2 Sesion 3 (infra) puede hacerse sin la URL, Sesion 4 la necesita
- Feature 3 es totalmente independiente de las otras dos
