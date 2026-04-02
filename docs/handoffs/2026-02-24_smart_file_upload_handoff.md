# Handoff: Smart File Upload (Canal 2)

**Fecha:** 2026-02-24
**Sesion anterior:** Brainstorming + planificacion
**Estado:** Plan aprobado, implementacion NO iniciada

---

## Que se hizo en esta sesion

1. **Brainstorming** de ingesta multi-canal → 3 canales definidos
   - Documento: `docs/plans/2026-02-24-ingesta-multicanal-design.md`
2. **Plan de implementacion** del Canal 2 (Smart File Upload) aprobado
   - Documento: `docs/plans/2026-02-24-smart-file-upload-plan.md`
3. **NO se escribio codigo** — solo planificacion y documentacion

---

## Que hacer en la proxima sesion

Implementar el plan en `docs/plans/2026-02-24-smart-file-upload-plan.md`.

### Orden de ejecucion

1. **Leer primero** estos archivos de referencia:
   - `database/migrations/017_rls_dual_mode_and_permissions.sql` (patron SQL)
   - `backend/engine/connectors/excel.py` (headers esperados)
   - `backend/engine/connectors/sync.py` (SyncEngine, connector_override)
   - `backend/scripts/sync_erp.py` (patron entry point)
   - `backend/config/settings.py` (donde agregar config)
   - `frontend/src/app/(dashboard)/datos/page.tsx` (donde integrar upload)
   - `frontend/src/components/predictions/prediction-actions.tsx` (patron client component)

2. **Paso 0 + Paso 1** en paralelo (sin dependencias entre si):
   - Paso 0: Migracion SQL (tabla upload_jobs + bucket Storage)
   - Paso 1: Plantilla Excel (openpyxl via script Python)

3. **Ejecutar migracion** 018 en la DB

4. **Paso 2 + Paso 3** en paralelo (ambos dependen de Paso 0):
   - Paso 2: Componente upload en frontend (file-upload.tsx)
   - Paso 3: Worker Python (process_uploads.py)

5. **Paso 4:** Indicador de frescura mejorado en datos/page.tsx

6. **Paso 5:** Configurar crontab del worker

7. **Verificacion end-to-end** (7 checks listados en el plan)

---

## Decisiones ya tomadas (NO re-discutir)

- **Tabla-cola** (upload_jobs) en vez de API Route o microservicio
- **Plantilla Excel** con formato fijo para MVP (no SmartFileConnector)
- **Client Component** sube directo a Storage (no pasa por Next.js server)
- **Worker Python via cron** cada 1 minuto (no daemon ni queue)
- **FOR UPDATE SKIP LOCKED** para evitar procesamiento duplicado

---

## Archivos clave del proyecto (contexto)

- `AGENTS.md` — reglas de seguridad y protocolos obligatorios
- `docs/ROADMAP.md` — roadmap general del proyecto
- `docs/PRD.md` — product requirements document
- Fase 0-3 completadas, esta es funcionalidad nueva post-Fase 3

---

## Riesgos a tener en cuenta

- El bucket de Storage necesita policies RLS en `storage.objects`
  (tabla interna de Supabase, no la creamos nosotros)
- ExcelConnector espera headers exactos — la plantilla debe coincidir
- SyncEngine.run() necesita verificar si acepta `connector_override`
  y `source_override` — leer el codigo antes de asumir
- SERVICE_ROLE_KEY viene de `/opt/orion-stack/.env` (propiedad de root)
  — Pato la tiene que copiar manualmente a `backend/.env`
