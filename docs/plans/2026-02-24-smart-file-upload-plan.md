# Plan de Implementacion: Canal 2 — Smart File Upload

**Fecha:** 2026-02-24
**Estado:** Aprobado
**Origen:** Brainstorming en `docs/plans/2026-02-24-ingesta-multicanal-design.md`

---

## Contexto

PymePilot necesita mas canales de ingesta de datos ademas de la API de ERP.
Muchos clientes no quieren dar acceso API (desconfianza) o no tienen ERP con API.
El brainstorming (aprobado, en `docs/plans/2026-02-24-ingesta-multicanal-design.md`)
definio 3 canales. Este plan implementa el **Canal 2: Smart File Upload** que es
la primera prioridad.

**Objetivo:** El cliente exporta sus ventas, las sube al dashboard, y PymePilot
las procesa automaticamente. Sin dar acceso API a nadie.

---

## Decisiones arquitectonicas

### 1. Como conectar frontend (Next.js) con backend (Python)

**Tabla `upload_jobs` como cola de trabajo.**

El frontend sube el archivo a Supabase Storage y crea un "job" en una tabla.
Un worker Python detecta jobs pendientes, descarga el archivo, ejecuta el
SyncEngine, y actualiza el status. El frontend hace polling para mostrar el
resultado.

**Por que esta y no otras:**
- API Route que ejecuta Python: el container de Next.js no tiene Python.
- Microservicio FastAPI: demasiada infra nueva para el MVP.
- La tabla-cola reutiliza todo lo existente (Supabase, SyncEngine, RLS).

### 2. Formato del archivo: plantilla Excel (MVP)

Para el MVP, el usuario descarga una plantilla Excel con el formato que
el ExcelConnector ya sabe parsear (4 hojas: Clientes, Productos, Ventas, Items).
Esto significa **0 cambios en el backend de parseo**.

Post-MVP: SmartFileConnector con deteccion automatica de columnas.

### 3. Upload: Client Component directo a Supabase Storage

El componente de upload es Client Component que usa `supabase.storage.upload()`
directo. El archivo nunca pasa por el servidor Next.js. Sigue el mismo patron
que `prediction-actions.tsx`.

---

## Pasos de implementacion

### Paso 0: Migracion SQL — tabla `upload_jobs` + bucket Storage

**Crear:**
- `database/migrations/018_create_upload_jobs.sql`
- `database/migrations/018_rollback.sql`

**Que hace:**
- Tabla `upload_jobs` (id, tenant_id, user_id, file_path, file_name,
  file_size_bytes, status, sync_log_id, error_message, timestamps)
- Status: pending → processing → completed/failed
- RLS con tenant isolation (misma policy que sync_log)
- Bucket `data-uploads` en Storage (privado, 10MB max, solo .xlsx)
- RLS en storage.objects: cada tenant solo sube/lee en `{tenant_id}/uploads/`

**Seguridad:**
- Bucket privado, MIME type restringido, limite de tamano
- `authenticated` tiene INSERT+SELECT (no puede cambiar status)
- `pymepilot_app` tiene SELECT+INSERT+UPDATE (worker cambia status)

**Patron de referencia:** `database/migrations/017_rls_dual_mode_and_permissions.sql`

---

### Paso 1: Plantilla Excel descargable

**Crear:**
- `frontend/public/templates/plantilla-pymepilot.xlsx`

**Que hace:** Archivo Excel con 4 hojas vacias + headers que coinciden
exactamente con lo que ExcelConnector espera:
- Clientes: Id, Nombre, Email, Telefono, Direccion, Ciudad, Notas
- Productos: Id, Nombre, Precio, SKU, Categoria, Subcategoria
- Ventas: Id, Fecha, Cliente, Total
- Items: OrdenId, ProductoId, NombreProducto, Cantidad, PrecioUnitario, Total

**Paralelizable con Paso 0.**

---

### Paso 2: Componente de upload en frontend

**Crear:**
- `frontend/src/components/upload/file-upload.tsx` (Client Component)

**Modificar:**
- `frontend/src/app/(dashboard)/datos/page.tsx` — integrar componente

**Flujo del componente:**
1. Zona drag-and-drop + boton seleccionar archivo
2. Validacion client-side: solo .xlsx, max 10MB
3. Upload a Storage: `supabase.storage.from('data-uploads').upload()`
   Path: `{tenant_id}/uploads/{timestamp}_{filename}`
4. Crear job: `supabase.from('upload_jobs').insert()`
5. Polling cada 5s a `upload_jobs` para mostrar status
6. Estados visuales: idle → uploading → processing → success/error

**Patron de referencia:** `frontend/src/components/predictions/prediction-actions.tsx`

**Seguridad:**
- tenant_id se obtiene del JWT (no del form)
- RLS en Storage y upload_jobs garantiza aislamiento
- Validacion de tipo y tamano antes de upload

**Depende de:** Paso 0.

---

### Paso 3: Worker Python para procesar uploads

**Crear:**
- `backend/scripts/process_uploads.py`

**Modificar:**
- `backend/config/settings.py` — agregar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

**Que hace:**
1. Query `upload_jobs WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`
2. Marca como `processing`
3. Descarga archivo de Storage via HTTP (con SERVICE_ROLE_KEY)
4. Crea ExcelConnector con el archivo temporal
5. Ejecuta `SyncEngine.run(connector_override=connector, source_override='upload')`
6. Actualiza job a `completed` (con sync_log_id) o `failed` (con error_message)
7. Elimina archivo temporal en `finally`

**Acceso a Storage:** HTTP GET con `Authorization: Bearer {SERVICE_ROLE_KEY}`.
La key es la misma que ya existe en `/opt/orion-stack/.env`.

**Seguridad:**
- `FOR UPDATE SKIP LOCKED` previene procesamiento duplicado
- Archivo temporal en `/tmp/` con umask 0o077, eliminado en `finally`
- SERVICE_ROLE_KEY solo en .env, capturada por SanitizingFormatter
- Timeout: si job lleva >10 min en processing, marcarlo como failed

**Patron de referencia:** `backend/scripts/sync_erp.py` (entry point pattern)

**Depende de:** Paso 0.

---

### Paso 4: Indicador de frescura mejorado

**Modificar:**
- `frontend/src/app/(dashboard)/datos/page.tsx`

**Que hace:**
- Antiguedad exacta de ultima sync (no solo ">48h")
- Escala visual: verde (<24h), amarillo (24-72h), rojo (>72h)
- Mensaje de impacto: "Datos de hace X dias — predicciones menos precisas"
- Boton "Actualizar datos" que scrollea al upload
- Historial de uploads recientes (query a upload_jobs)

**Depende de:** Pasos 0 y 2.

---

### Paso 5: Worker como cron (1 min)

**Que hace:** Crontab para ejecutar `process_uploads.py` cada minuto.

```
* * * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/process_uploads.py >> /home/pato/logs/upload-worker.log 2>&1
```

**Depende de:** Paso 3.

---

### Post-MVP (no en este plan)

- **Upload incremental:** Merge de datos nuevos sin reemplazar historico
- **Email inbox:** Recibir archivos por email
- **SmartFileConnector:** Deteccion automatica de columnas
- **Carpeta sync:** Google Drive / Dropbox monitoring

---

## Orden y paralelismo

```
Paso 0 (SQL) ──────┬──► Paso 2 (Frontend) ──► Paso 4 (Frescura)
                    │
Paso 1 (Plantilla) ─┘──► Paso 3 (Worker) ───► Paso 5 (Cron)
```

Pasos 0 y 1 se hacen en paralelo (sin dependencias).
Pasos 2 y 3 se pueden empezar en paralelo (ambos dependen de Paso 0).

---

## Archivos a crear (5)

| Archivo | Tipo |
|---------|------|
| `database/migrations/018_create_upload_jobs.sql` | SQL |
| `database/migrations/018_rollback.sql` | SQL |
| `frontend/public/templates/plantilla-pymepilot.xlsx` | Excel |
| `frontend/src/components/upload/file-upload.tsx` | React |
| `backend/scripts/process_uploads.py` | Python |

## Archivos a modificar (2)

| Archivo | Cambio |
|---------|--------|
| `frontend/src/app/(dashboard)/datos/page.tsx` | Integrar upload + frescura |
| `backend/config/settings.py` | SUPABASE_URL + SERVICE_ROLE_KEY |

## Archivos que NO se modifican

| Archivo | Razon |
|---------|-------|
| `backend/engine/connectors/excel.py` | Funciona tal cual |
| `backend/engine/connectors/sync.py` | Funciona con connector_override |
| `backend/engine/connectors/base.py` | Sin cambios |

---

## Verificacion end-to-end

1. **Migracion:** Ejecutar 018, verificar tabla + bucket + policies en DB
2. **Plantilla:** Descargar, abrir en Excel, verificar 4 hojas con headers
3. **Upload frontend:** Login → /datos → arrastrar Excel → ver progreso
4. **Worker:** Verificar que job pasa de pending → processing → completed
5. **Datos:** Verificar que customers/products/orders tienen los datos del Excel
6. **Frescura:** Verificar que el indicador muestra verde despues del upload
7. **Seguridad:** Intentar subir .exe (rechazado), subir archivo >10MB (rechazado),
   verificar que tenant A no ve uploads de tenant B
