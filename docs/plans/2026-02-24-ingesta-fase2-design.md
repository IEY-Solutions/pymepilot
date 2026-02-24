# Diseno: Ingesta Multi-Canal — Fase 2 (Completar pendientes)

**Fecha:** 2026-02-24
**Estado:** Aprobado
**Origen:** Brainstorming sobre 3 features pendientes del design doc multi-canal
**Prerequisito:** Smart File Upload (Canal 2) ya implementado (commit `798a961`)

---

## Alcance

3 features para completar el sistema de ingesta multi-canal:

| # | Feature | Estado previo | Enfoque aprobado |
|---|---------|--------------|------------------|
| 1 | Indicador de frescura + notificaciones | Parcial (banner existe) | Dashboard mejorado + sistema enchufable |
| 2 | Upload incremental (append) | No existia | Hash de contenido como external_id |
| 3 | Google Drive sync (Canal 3) | No existia | Service Account + carpeta compartida |

**Descartado:** Canal 2b (email inbox) — eliminado del roadmap por decision del usuario.

---

## Feature 1: Notificaciones de datos desactualizados

### Dashboard (mejoras al existente)

- **Badge en sidebar/bottom-nav:** Punto rojo en icono "Datos" cuando datos > 72h.
  El cliente lo ve apenas entra al dashboard, no solo en /datos.
- **Card en home (KPIs):** Estado de datos con antiguedad + link a /datos.
  Hoy la home no tiene info sobre frescura.

### Sistema de notificaciones (backend nuevo)

#### Tablas nuevas

```sql
-- Configuracion de notificaciones por tenant
CREATE TABLE tenant_notification_config (
    tenant_id               UUID PRIMARY KEY REFERENCES tenants(id),
    stale_data_threshold_hours INTEGER DEFAULT 72,
    channels_enabled        JSONB DEFAULT '{"dashboard": true, "whatsapp": false}',
    whatsapp_number         TEXT,    -- futuro
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Notificaciones enviadas (inbox del dashboard + log de otros canales)
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    channel     TEXT NOT NULL,          -- 'dashboard', 'whatsapp' (futuro)
    type        TEXT NOT NULL,          -- 'stale_data', 'sync_failed', etc.
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    read        BOOLEAN DEFAULT false,  -- solo para dashboard
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: cada tenant ve solo sus propias notificaciones y config.

#### Script `check_data_freshness.py`

Cron: 5:30 AM (despues del sync diario).

Flujo:
1. Para cada tenant activo: calcular horas desde ultimo sync
2. Si supera umbral: verificar en `notifications` si ya se notifico hoy
3. Si no se notifico: insertar notificacion para canales habilitados
4. Canal "dashboard": insert en `notifications` (frontend lo lee)
5. Canal "whatsapp": llamar al provider API (futuro, cuando este configurado)

#### Frontend

- Badge de notificaciones no leidas en header/sidebar
- Endpoint: `notifications WHERE read = false AND tenant_id = current`
- Al hacer click en notificacion: marcar como leida

### Canales enchufables

Diseno preparado para agregar WhatsApp API cuando el usuario tenga proveedor:
- Cada canal es un modulo independiente
- `tenant_notification_config.channels_enabled` controla cuales estan activos
- Agregar WhatsApp = implementar `WhatsAppNotifier` + actualizar config

---

## Feature 2: Upload incremental (Append con hash de contenido)

### Problema

SmartFileConnector genera external_ids secuenciales (1, 2, 3...).
Cada upload colisiona con los anteriores → UPSERT pisa datos → no hay historial.

### Solucion

Cambiar la generacion de external_id a hash de contenido.
SyncEngine no se modifica (el UPSERT funciona igual).

#### Logica de hash por entidad

| Entidad | Campos del hash | Ejemplo |
|---------|-----------------|---------|
| Clientes | nombre normalizado | `su_` + md5("juan perez")[:12] |
| Productos | nombre + sku (si existe) | `su_` + md5("funda magsafe pro")[:12] |
| Ordenes | fecha + cliente_norm + total | `su_` + md5("2026-01-24\|juan perez\|15000")[:12] |

Prefijo `su_` (smart upload) evita colision con IDs del Canal 1 (ERP).

Normalizacion: lowercase, strip whitespace, quitar acentos (unidecode o manual).

#### Resultado esperado

```
Upload #1 (enero): 30 clientes, 200 productos, 40 ordenes
  → Se insertan todos

Upload #2 (febrero): 35 clientes, 210 productos, 50 ordenes
  → 30 existentes se ACTUALIZAN, 5 nuevos se INSERTAN
  → 200 existentes se ACTUALIZAN, 10 nuevos se INSERTAN
  → 40 ordenes existentes no cambian, 10 nuevas se INSERTAN

Resultado final: 35 clientes, 210 productos, 50 ordenes
```

#### Archivos a modificar

Solo `backend/engine/connectors/smart.py`:
- `_parse_mixed_sales()`: IDs por hash
- `_parse_customers_sheet()`: IDs por hash
- `_parse_products_sheet()`: IDs por hash
- `_parse_orders_sheet()`: IDs por hash
- Nueva funcion `_content_hash(text: str) -> str`

**SyncEngine intacto.** El `ON CONFLICT DO UPDATE` ya maneja todo.

---

## Feature 3: Google Drive Sync (Canal 3)

### Setup inicial (una vez, en el servidor)

1. Crear proyecto en Google Cloud Console
2. Habilitar Google Drive API
3. Crear Service Account → descargar JSON de credenciales
4. Guardar JSON en servidor, path en `.env`: `GOOGLE_SERVICE_ACCOUNT_PATH`

### Flujo del cliente (setup unico)

1. En `/datos` del dashboard: seccion "Conectar Google Drive"
2. Instrucciones: "Comparti tu carpeta con sync@pymepilot-xxx.iam.gserviceaccount.com"
3. Pega el link de la carpeta
4. PymePilot extrae folder_id, hace test (lista archivos)
5. Si OK → conexion activa

### DB

```sql
CREATE TABLE drive_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    folder_id       TEXT NOT NULL,
    status          TEXT DEFAULT 'active',  -- active / paused / error
    last_synced_at  TIMESTAMPTZ,
    last_file_hash  TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: tenant isolation. UNIQUE en tenant_id (1 conexion por tenant).

### Sync diario (script `sync_google_drive.py`)

Cron: 4:30 AM (antes del sync ERP a las 5 AM).

```
1. SELECT * FROM drive_connections WHERE status = 'active'
2. Para cada conexion:
   a. Listar archivos .xlsx en carpeta (Drive API)
   b. Comparar modified_time con last_synced_at
   c. Si hay archivos nuevos/modificados:
      - Descargar a /tmp/
      - Crear upload_job (misma cola que Canal 2)
      - El worker existente (process_uploads.py) lo procesa
   d. Actualizar last_synced_at + last_file_hash
   e. Si falla: status='error', error_message, continuar con siguiente tenant
```

**Reutilizacion:** 100% del pipeline existente. Drive solo alimenta la cola.
SmartFileConnector + SyncEngine hacen el trabajo pesado.

### Frontend

Seccion en `/datos`:
- Estado de conexion (activa/error/no configurada)
- Boton "Conectar Google Drive" → modal con instrucciones
- Input para pegar link de carpeta
- Boton "Desconectar"
- Ultima sync automatica: fecha + resultado

### Seguridad

- Credenciales Service Account en archivo JSON (path en .env, no en DB)
- Service Account solo tiene lectura en carpetas compartidas
- No puede acceder a carpetas no compartidas
- Solo descarga .xlsx
- Archivos temporales: /tmp/, umask 0o077, eliminados post-proceso

### Dependencias

- `google-api-python-client` + `google-auth` (SDK oficial)
- Agregar a `requirements.txt`

---

## Orden de implementacion

| Orden | Feature | Razon |
|-------|---------|-------|
| 1 | Upload incremental (hash) | Cambio minimo, solo smart.py, beneficio inmediato |
| 2 | Notificaciones + frescura | Tablas + script + mejoras UI |
| 3 | Google Drive sync | Mas complejo, depende de Google Cloud setup |

Feature 1 y 2 pueden paralelizarse (no dependen entre si).
Feature 3 depende del upload incremental (Drive alimenta la misma cola).

---

## Riesgos

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| Hash collision (2 clientes, mismo nombre) | Datos mezclados | Hash incluye mas campos si disponibles. Colision en md5[:12] es 1 en 16^12 |
| Google bloquea Service Account | Drive sync se rompe | Respetar rate limits, retry con backoff, status='error' para visibilidad |
| WhatsApp API demora en setup | Notificaciones limitadas a dashboard | Dashboard funciona standalone, WhatsApp es aditivo |
| Carpeta Drive con miles de archivos | Sync lento | Solo listar .xlsx, limitar a ultimos 10 archivos modificados |
