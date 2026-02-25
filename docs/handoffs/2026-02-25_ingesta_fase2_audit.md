# Handoff: Auditoria Ingesta Fase 2

**Fecha:** 2026-02-25
**Sesion:** Auditoria de seguridad post-implementacion
**Commits:** `b806ce8` (bloque 1), `d463daa` (bloque 2), `1c1f48c` (bloque 3)

---

## Que se hizo

Auditoria completa de la Ingesta Fase 2 con 4 agentes especializados en paralelo:

| Agente | Area auditada |
|--------|--------------|
| @security-guardian | RLS, credenciales, XSS, patron RLS global |
| @python-engine | sync_google_drive.py, check_data_freshness.py, smart.py, process_uploads.py |
| @nextjs-dashboard | Frontend components, queries, consistencia con design doc |
| @db-architect | Migracion 019 vs DB real, FK, indices, rollback |

---

## Hallazgos totales: 24

| Severidad | Cantidad | Corregidos | Pendientes |
|-----------|----------|------------|------------|
| CRITICAL | 1 | 1 | 0 |
| HIGH | 4 | 4 | 0 |
| MEDIUM | 8 | 7 | 1 (M-07) |
| LOW | 6 | 6 | 0 |
| INFO | 5 | 0 (no requieren accion) | 0 |

---

## Bloque 1 — Seguridad obligatoria (commit `b806ce8`)

### C-01 [CRITICAL] Archivos de Drive sin limite de tamano → OOM kill
- **Archivo:** `sync_google_drive.py`
- **Problema:** `_download_file()` descargaba sin limite + `_upload_to_storage()` hacia `f.read()` de todo el archivo en RAM. Archivo de 500MB → OOM kill del VPS.
- **Fix:** `MAX_FILE_SIZE_BYTES = 10MB`, check con `os.path.getsize()` post-descarga, `os.unlink()` si excede.

### H-01 [HIGH] error_message no sanitizado → credenciales en DB
- **Archivo:** `sync_google_drive.py:232`
- **Problema:** `str(exc)[:500]` se guardaba directo en DB. Google API puede incluir tokens en error messages.
- **Fix:** `sanitize_text(str(exc))[:500]` (mismo patron que `process_uploads.py`).

### H-02 [HIGH] Conexion DB compartida sin aislamiento de transacciones
- **Archivo:** `sync_google_drive.py:207-244`
- **Problema:** Una sola conexion para todos los tenants. Si tenant A fallaba, la conexion quedaba en INERROR y tenant B fallaba silenciosamente.
- **Fix:** `with conn.transaction():` por tenant. `conn.commit()` post-SELECT para cerrar transaccion implicita.

### H-03 [HIGH] Migracion 018 desalineada con DB real (drift)
- **Archivo:** `database/migrations/018_create_upload_jobs.sql`
- **Problema:** Dice `user_id NOT NULL` pero DB tiene nullable (cambio manual).
- **Fix:** Migracion 020: `ALTER TABLE upload_jobs ALTER COLUMN user_id DROP NOT NULL`.

### H-04 [HIGH] FK inconsistente: 4 tablas con NO ACTION vs 7 con CASCADE
- **Tablas:** upload_jobs, notifications, tenant_notification_config, drive_connections
- **Problema:** Borrar un tenant tiraba FK violation en estas 4 tablas.
- **Fix:** Migracion 020: ALTER FK a `ON DELETE CASCADE` en las 4 tablas.

### M-01 [MEDIUM] Path traversal en file_name de Drive (bonus)
- **Archivo:** `sync_google_drive.py:270`
- **Problema:** `file_meta["name"]` viene del usuario de Drive. Nombre como `../../etc/cron.d/x.xlsx` → escribe fuera de temp_dir.
- **Fix:** `_sanitize_filename()` con `os.path.basename()` + regex `[^\w.\-]`.

### M-02 [MEDIUM] Sin validacion de env vars (bonus)
- **Archivo:** `sync_google_drive.py`
- **Problema:** Si SUPABASE_URL o SERVICE_ROLE_KEY vacias → error confuso.
- **Fix:** Validacion al inicio de `sync_all_connections()`.

### L-03 [LOW] Sin logging inicio/fin (bonus)
- **Fix:** `logger.info("Drive sync: INICIO/FIN")` en `main()`.

---

## Bloque 2 — Robustez recomendada (commit `d463daa`)

### M-03 [MEDIUM] Commit global puede perder notificaciones
- **Archivo:** `check_data_freshness.py:78-87`
- **Problema:** Un unico `conn.commit()` al final del loop. Si tenant B falla con error DB → INERROR → commit final pierde notificaciones de TODOS.
- **Fix:** `conn.commit()` despues de cada tenant exitoso, `conn.rollback()` en el except.

### M-06 [MEDIUM] getFreshnessInfo() no valida fechas invalidas
- **Archivo:** `frontend/src/lib/freshness.ts`
- **Problema:** Fecha invalida → `NaN` en ageHours → "hace NaN dias" en rojo. Fecha futura → horas negativas → "hace -3 horas".
- **Fix:** `isNaN(parsed)` → return null. `Math.max(0, ageMs)` para futuras.

### M-08 [MEDIUM] Query de predictions trae TODAS las filas
- **Archivo:** `frontend/src/app/(dashboard)/page.tsx:63`
- **Problema:** `SELECT status FROM predictions` traia todas las filas a memoria para calcular un porcentaje. Ineficiente con miles de predicciones.
- **Fix:** Dos queries con `{ count: "exact", head: true }` (solo piden el numero, no datos).

### L-04 [LOW] .single() falla con 0 filas
- **Archivo:** `page.tsx:77`
- **Problema:** `.single()` en sync_log lanza error si tenant no tiene syncs.
- **Fix:** `.maybeSingle()` retorna null sin error.

### L-05 [LOW] "hace 0 horas" copy fix
- **Archivo:** `freshness.ts:32`
- **Fix:** `ageHours < 1` → "hace menos de 1 hora" (consistente con `timeAgo()` en page.tsx).

---

## Bloque 3 — Mejoras (commit `1c1f48c`)

### L-01 [LOW] MD5 → SHA256
- **Archivo:** `smart.py:551`
- **Fix:** `from hashlib import sha256` reemplaza `md5`. Mismo truncado a 12 hex chars.
- **EFECTO SECUNDARIO:** Proximo upload de IEY genera external_ids diferentes → registros duplicados por una vez. No se pierden datos.

### M-04 [MEDIUM] _read_sheet() sin limite de filas
- **Archivo:** `smart.py:321`
- **Problema:** `list(ws.iter_rows())` carga toda la hoja en RAM.
- **Fix:** Loop con `MAX_ROWS_PER_SHEET = 50_000` + warning si trunca.

### L-02 [LOW] INTERVAL parametrizado
- **Archivo:** `process_uploads.py:240`
- **Problema:** `INTERVAL '%s minutes'` — ambiguo si psycopg3 interpreta %s dentro de literal.
- **Fix:** `make_interval(mins => %s)` — parametro bind real de PostgreSQL.

### L-06 [LOW] folder_id sin truncamiento visual
- **Archivo:** `drive-connection.tsx:168`
- **Fix:** CSS `truncate max-w-[200px]` + `title` attribute para tooltip.

### M-05 [MEDIUM] Migracion 019 no idempotente
- **Archivo:** `019_notifications_and_drive.sql`
- **Problema:** `CREATE POLICY` sin `DROP POLICY IF EXISTS` previo → falla si se re-ejecuta.
- **Fix:** 6x `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`.

---

## Pendiente (deferred)

### M-07 [MEDIUM] Verificacion de acceso Drive antes de guardar
- **Archivo:** `drive-connection.tsx`
- **Que falta:** El design doc pedia un boton "Verificar acceso" que llame a Google Drive API para confirmar que el Service Account tiene acceso a la carpeta ANTES de guardar. Actualmente se guarda como "active" sin verificar, y el usuario se entera del error recien al dia siguiente cuando corre el cron.
- **Requiere:** Server Action o API route con acceso a credenciales del Service Account.
- **Clasificacion:** Feature nueva, no fix de seguridad. No bloquea produccion.

---

## Archivos modificados (7)

| Archivo | Cambios |
|---------|---------|
| `backend/scripts/sync_google_drive.py` | C-01, H-01, H-02, M-01, M-02, L-03 (6 fixes) |
| `backend/scripts/check_data_freshness.py` | M-03 (commit por tenant) |
| `backend/engine/connectors/smart.py` | L-01 (SHA256), M-04 (row limit) |
| `backend/scripts/process_uploads.py` | L-02 (make_interval) |
| `frontend/src/lib/freshness.ts` | M-06, L-05 (NaN guard, copy fix) |
| `frontend/src/app/(dashboard)/page.tsx` | M-08, L-04 (count queries, maybeSingle) |
| `frontend/src/components/drive/drive-connection.tsx` | L-06 (truncate CSS) |

## Archivos creados (2)

| Archivo | Que hace |
|---------|---------|
| `database/migrations/020_fix_nullable_and_cascade.sql` | user_id nullable + FK CASCADE |
| `database/migrations/020_rollback.sql` | Revierte 020 |

## Archivos actualizados (solo archivo, no DB)

| Archivo | Cambio |
|---------|--------|
| `database/migrations/019_notifications_and_drive.sql` | M-05: DROP POLICY IF EXISTS |

---

## Estado de la DB

- **Migracion 020:** Ejecutada OK en orion_db
- **11 FK a tenants:** Todas con `ON DELETE CASCADE` (verificado)
- **upload_jobs.user_id:** Nullable (verificado)
- **11 RLS policies:** Todas usan `get_current_tenant_id()` (verificado)
- **Indices:** Todos presentes y correctos

---

## Deploy

- Frontend rebuild: `docker compose build --no-cache dashboard` OK
- Container: `pymepilot-dashboard` corriendo, Ready en 175ms
- URL: `app.pymepilot.cloud` (HTTPS via Traefik)

---

## Puntos para re-auditar

### Verificar que los fixes funcionan:
- [ ] C-01: Subir archivo >10MB a carpeta Drive de IEY → debe rechazarse con error claro
- [ ] H-01: Provocar error de Google API → verificar que error_message en DB no tiene tokens
- [ ] H-02: Simular fallo de un tenant en Drive sync → verificar que otros tenants procesan OK
- [ ] M-03: Simular fallo de freshness check en un tenant → verificar que otros reciben notificacion
- [ ] M-08: Verificar que KPIs muestran numeros correctos en dashboard
- [ ] L-04: Crear tenant de prueba sin sync_log → home page no debe dar error

### Verificar consistencia:
- [ ] Migracion 020 vs DB real: comparar constraints
- [ ] SHA256 hash: subir Excel de IEY → verificar que genera registros (no duplica catastroficamente)
- [ ] make_interval: ejecutar `--timeout-check` y verificar que no tira error SQL

### Verificar que NO se rompio nada:
- [ ] Login en app.pymepilot.cloud
- [ ] KPIs cargan datos
- [ ] Contactar muestra predicciones
- [ ] Datos muestra syncs + upload component
- [ ] DriveConnection muestra estado de conexion IEY

---

## Crontab actual (sin cambios)

```
0 3 * * *   backup PostgreSQL
* * * * *   upload worker (process_uploads.py)
30 4 * * *  Google Drive sync
30 5 * * *  freshness check
```
