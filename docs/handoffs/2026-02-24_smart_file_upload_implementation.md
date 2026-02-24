# Handoff: Smart File Upload (Canal 2) — Implementacion

**Fecha:** 2026-02-24
**Sesion:** Implementacion completa + fixes + test E2E
**Estado:** COMPLETADO y operativo
**Commit:** `798a961`

---

## Que se hizo

Implementacion end-to-end del Canal 2 de ingesta de datos.
El usuario sube su propio Excel (cualquier formato), Claude AI detecta
y mapea las columnas automaticamente, y SyncEngine importa los datos.

### Pivot critico durante la sesion

El plan original (v1) requeria una plantilla fija que el usuario llenaba.
Pato lo descarto: "no puede haber friccion en hacerle completar un excel
desde 0". Se hizo brainstorming y se aprobo el plan v2 (SmartFileConnector
con Claude AI). Design doc: `docs/plans/2026-02-24-smart-file-upload-v2-design.md`

---

## Archivos creados (6 nuevos)

| Archivo | Que es |
|---------|--------|
| `backend/engine/connectors/smart.py` | SmartFileConnector — parsea Excel arbitrario con Claude |
| `backend/scripts/process_uploads.py` | Worker Python (cron cada 1 min, cola FOR UPDATE SKIP LOCKED) |
| `backend/config/prompts/smart_upload.txt` | Prompt para Claude (~2k tokens por analisis) |
| `database/migrations/018_create_upload_jobs.sql` | Tabla upload_jobs + bucket Storage + RLS policies |
| `database/migrations/018_rollback.sql` | Rollback de la migracion 018 |
| `frontend/src/components/upload/file-upload.tsx` | Componente drag-and-drop multi-archivo |

## Archivos modificados (2)

| Archivo | Cambio |
|---------|--------|
| `backend/config/settings.py` | +2 variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Integrar upload + indicador frescura + uploads recientes |

## Archivos eliminados (2, obsoletos del plan v1)

- `backend/scripts/generate_template.py`
- `frontend/public/templates/plantilla-pymepilot.xlsx`

## Archivos NO tocados (todo Canal 1 intacto)

- `backend/engine/connectors/excel.py` — ExcelConnector original
- `backend/engine/connectors/sync.py` — SyncEngine sin cambios
- `backend/engine/connectors/base.py` — ERPConnector ABC
- `backend/engine/connectors/contabilium.py` — Canal 1
- `database/migrations/001-017` — todas intactas

---

## Fixes aplicados durante implementacion (3)

### Fix 1: RLS policies de Storage

**Problema:** Las migraciones internas de Supabase Storage nunca se ejecutaron
(filas en `storage.migrations` fueron insertadas en bulk sin correr SQL real).
RLS estaba activado en `storage.buckets` y `storage.objects` pero sin policies
→ todo bloqueado, bucket invisible via API.

**Fix:** Creadas 2 policies manuales:
- `service_role_buckets_all` en `storage.buckets` (FOR ALL TO service_role)
- `service_role_objects_all` en `storage.objects` (FOR ALL TO service_role)

### Fix 2: Worker no encontraba jobs

**Problema:** `upload_jobs` tiene `FORCE ROW LEVEL SECURITY` y la policy
requiere `tenant_id = get_current_tenant_id()`. El worker usa
`get_db_connection_no_tenant()` (sin tenant context), asi que
`get_current_tenant_id()` retorna NULL → query siempre vacia.

**Fix:** Policy adicional `upload_jobs_worker_access` que permite a
`pymepilot_app` acceso cross-tenant (USING true, WITH CHECK true).

### Fix 3: Fechas DD/MM/YYYY

**Problema:** Excel argentino usa DD/MM/YYYY, PostgreSQL espera YYYY-MM-DD.
El SmartFileConnector pasaba la fecha como string sin normalizar.
Error: `date/time field value out of range: "24/01/2026"`

**Fix:** Funcion `_normalize_date()` en smart.py que soporta:
- datetime/date de Python (de openpyxl)
- DD/MM/YYYY y DD-MM-YYYY (formato argentino)
- YYYY-MM-DD (formato ISO)
- DD/MM/YY (formato corto)

---

## Configuracion manual aplicada en el servidor

1. **Variables en .env** (raiz del proyecto):
   - `SUPABASE_URL=http://172.18.0.11:8000`
   - `SUPABASE_SERVICE_ROLE_KEY=<JWT generado con generate_service_role_jwt.py>`

2. **Crontab** (usuario pato):
   ```
   * * * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/process_uploads.py >> /home/pato/logs/upload-worker.log 2>&1
   ```

3. **SERVICE_ROLE_KEY**: Generada con `backend/scripts/generate_service_role_jwt.py`.
   Es un JWT firmado con JWT_SECRET (HS256), claims: role=service_role, iss=supabase.
   La key cruda de `/opt/orion-stack/.env` NO funciona con Kong (Invalid Compact JWS).

4. **Policies de Storage**: Creadas directamente en la DB (no via migracion de Storage).
   Documentadas en migracion 018 para referencia.

---

## Test end-to-end exitoso

```
Archivo subido: _tmp_Comprobantes_86069_20260223.xlsx (90KB)
Claude: 2,362 tokens, $0.009 USD
Resultado: 32 clientes, 226 productos, 44 ordenes importadas
Tiempo total: ~4 segundos (upload + analisis + sync)
```

DB final: 72 clientes, 246 productos, 74 ordenes, 1 upload completado.

---

## Notas tecnicas para proxima sesion

- **Storage migrations rotas**: Las 56 filas en `storage.migrations` fueron
  insertadas en bulk sin ejecutar SQL real. El servicio arranca OK pero con
  startupError repetido. No afecta la funcionalidad actual (nuestras policies
  manuales cubren lo necesario). Si se necesitan features avanzadas de Storage
  (transformaciones de imagen, etc.), habria que resolver esto.

- **search_path = auth, public**: En orion_db el search_path prioriza `auth`.
  CREATE TABLE sin schema explicito va a `auth`. Siempre usar `public.` prefix.

- **Bucket allowed_mime_types**: La columna es `text[]` (no JSONB).
  Usar `ARRAY[...]::text[]`, no `'{...}'::jsonb`.

- **Kong y JWTs**: Las API keys para Kong deben ser JWTs firmados con
  JWT_SECRET (HS256). No strings arbitrarios. Script en
  `backend/scripts/generate_service_role_jwt.py`.

---

## Post-MVP (NO implementado, para futuro)

- Preview del mapeo antes de procesar
- Upload incremental (merge sin reemplazar)
- Soporte CSV
- Email inbox para recibir archivos
