# Plan de Implementacion: Ingesta Multi-Canal — Fase 2

**Fecha:** 2026-02-24
**Design doc:** `docs/plans/2026-02-24-ingesta-fase2-design.md`
**Estado:** Pendiente aprobacion

---

## Paso 1: Upload incremental (hash de contenido)

**Archivos:** Solo `backend/engine/connectors/smart.py`
**Tiempo estimado:** ~30 min
**Riesgo:** Bajo — cambio aislado en un solo archivo

### 1A: Funcion helper `_content_hash()`

Crear funcion module-level:
```python
def _content_hash(*parts: str) -> str:
    """Genera external_id estable basado en contenido.
    Prefijo 'su_' para evitar colision con IDs del Canal 1 (ERP)."""
    normalized = "|".join(
        unicodedata.normalize("NFKD", str(p)).encode("ascii", "ignore").decode().lower().strip()
        for p in parts if p
    )
    return "su_" + md5(normalized.encode()).hexdigest()[:12]
```

Agregar `import unicodedata` al inicio del archivo.

### 1B: Actualizar `_parse_mixed_sales()`

Cambiar generacion de IDs de clientes:
- ANTES: `cid = str(len(customer_ids) + 1)`
- DESPUES: `cid = _content_hash(name)`

Cambiar generacion de IDs de productos:
- ANTES: `pid = str(len(product_ids) + 1)`
- DESPUES: `pid = _content_hash(pname)`

Cambiar generacion de IDs de ordenes:
- ANTES: `oid = str(order_counter)`
- DESPUES: `oid = _content_hash(str(fecha), customer_name, str(line_total or order["Total"]))`

### 1C: Actualizar `_parse_customers_sheet()`

- ANTES: `cid = _get_mapped(row, reverse_map, "customer_id") or str(i)`
- DESPUES: `cid = _get_mapped(row, reverse_map, "customer_id") or _content_hash(str(name))`

### 1D: Actualizar `_parse_products_sheet()`

- ANTES: `pid = _get_mapped(row, reverse_map, "product_id") or str(i)`
- DESPUES: `pid = _get_mapped(row, reverse_map, "product_id") or _content_hash(str(name), str(sku or ""))`

### 1E: Actualizar `_parse_orders_sheet()`

- ANTES: `oid = _get_mapped(row, reverse_map, "order_id") or str(i)`
- DESPUES: `oid = _get_mapped(row, reverse_map, "order_id") or _content_hash(str(fecha), str(customer_ref or ""), str(total or ""))`

### Verificacion

- Subir el mismo Excel 2 veces → la DB debe tener exactamente los mismos registros (no duplicados)
- Subir un Excel con datos nuevos → los nuevos se agregan, los existentes se actualizan
- Los IDs del Canal 1 (ERP) no se ven afectados (no tienen prefijo `su_`)

---

## Paso 2: Migracion SQL — tablas de notificaciones y drive_connections

**Archivos:**
- `database/migrations/019_notifications_and_drive.sql` (CREAR)
- `database/migrations/019_rollback.sql` (CREAR)

**Tiempo estimado:** ~20 min

### Contenido de la migracion

```sql
BEGIN;

-- 1. Configuracion de notificaciones por tenant
CREATE TABLE IF NOT EXISTS public.tenant_notification_config (
    tenant_id                   UUID PRIMARY KEY REFERENCES tenants(id),
    stale_data_threshold_hours  INTEGER NOT NULL DEFAULT 72,
    channels_enabled            JSONB NOT NULL DEFAULT '{"dashboard": true}',
    whatsapp_number             TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_notification_config FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_notification_config_isolation
    ON tenant_notification_config
    FOR ALL USING (tenant_id = get_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON tenant_notification_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON tenant_notification_config TO pymepilot_app;

-- 2. Notificaciones (inbox dashboard + log de canales)
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    channel     TEXT NOT NULL CHECK (channel IN ('dashboard', 'whatsapp')),
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT false,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_unread
    ON notifications (tenant_id, created_at DESC) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY notifications_tenant_isolation ON notifications
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY notifications_worker_access ON notifications
    FOR ALL TO pymepilot_app
    USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notifications TO pymepilot_app;

-- 3. Conexiones Google Drive
CREATE TABLE IF NOT EXISTS public.drive_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    folder_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'error')),
    last_synced_at  TIMESTAMPTZ,
    last_file_hash  TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY drive_connections_tenant_isolation ON drive_connections
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY drive_connections_worker_access ON drive_connections
    FOR ALL TO pymepilot_app
    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON drive_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON drive_connections TO pymepilot_app;

COMMIT;
```

### Ejecutar migracion

Via docker cp + psql (mismo metodo que migraciones anteriores).

---

## Paso 3: Script de chequeo de frescura

**Archivos:**
- `backend/scripts/check_data_freshness.py` (CREAR)

**Tiempo estimado:** ~30 min

### Que hace

1. Conecta sin tenant context (cross-tenant)
2. Para cada tenant: obtiene ultimo sync_log.started_at
3. Calcula horas de antiguedad
4. Consulta tenant_notification_config para umbral (default 72h)
5. Si supera umbral: verifica si ya notifico hoy
6. Si no notifico: inserta en notifications (canal=dashboard)
7. Futuro: canal=whatsapp → llama a WhatsApp API

### Cron

```
30 5 * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/check_data_freshness.py >> /home/pato/logs/freshness-check.log 2>&1
```

---

## Paso 4: Mejoras de UI — notificaciones + frescura

**Archivos a modificar:**
- `frontend/src/app/(dashboard)/datos/page.tsx` — card de Drive connection
- `frontend/src/components/layout/sidebar.tsx` o `bottom-nav.tsx` — badge notificaciones
- `frontend/src/app/(dashboard)/page.tsx` — card frescura en home

**Archivos a crear:**
- `frontend/src/components/notifications/notification-badge.tsx`

**Tiempo estimado:** ~45 min

### Badge de notificaciones

Client Component que:
1. Query: `notifications WHERE read = false` (count)
2. Muestra badge numerico en el sidebar
3. Popover con lista de notificaciones
4. Click marca como leida

### Card de frescura en home

Reusar logica de `getFreshnessInfo()` de datos/page.tsx.
Mostrar card con color + mensaje + link a /datos.

---

## Paso 5: Google Drive — setup backend

**Archivos:**
- `backend/scripts/sync_google_drive.py` (CREAR)
- `backend/config/settings.py` (MODIFICAR: +GOOGLE_SERVICE_ACCOUNT_PATH)
- `backend/requirements.txt` (MODIFICAR: +google-api-python-client, +google-auth)

**Tiempo estimado:** ~1 hora

### Script sync_google_drive.py

1. Cargar credenciales Service Account desde path en .env
2. Para cada drive_connection activa:
   a. Listar archivos .xlsx en folder_id
   b. Filtrar por modified_time > last_synced_at
   c. Si hay nuevos: descargar a /tmp/
   d. Crear upload_job en la cola (mismo flujo que Canal 2)
   e. Actualizar last_synced_at
3. Manejar errores por tenant (uno falla, sigue con el siguiente)

### Cron

```
30 4 * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/sync_google_drive.py >> /home/pato/logs/drive-sync.log 2>&1
```

---

## Paso 6: Google Drive — UI frontend

**Archivos:**
- `frontend/src/components/drive/drive-connection.tsx` (CREAR)
- `frontend/src/app/(dashboard)/datos/page.tsx` (MODIFICAR)

**Tiempo estimado:** ~45 min

### Componente DriveConnection

1. Muestra estado actual: no conectado / activo / error
2. Boton "Conectar Google Drive":
   - Modal con instrucciones (email del Service Account para compartir)
   - Input para pegar link de carpeta
   - Boton "Verificar acceso" → Server Action que testea folder_id
3. Si conectado: ultima sync, boton "Desconectar"

---

## Paso 7: Google Cloud Console setup

**Manual (lo hace Pato con guia):**
1. Crear proyecto en console.cloud.google.com
2. Habilitar Google Drive API
3. Crear Service Account
4. Descargar JSON de credenciales
5. Copiar al servidor
6. Agregar path a .env

---

## Paso 8: Verificacion end-to-end

### Upload incremental
- [ ] Subir Excel A → verificar datos insertados
- [ ] Subir Excel A de nuevo → misma cantidad de registros (no duplicados)
- [ ] Subir Excel B (datos nuevos) → registros de A + B presentes

### Notificaciones
- [ ] Tenant con datos > 72h → notificacion en notifications
- [ ] Badge visible en dashboard
- [ ] Click en notificacion → marca como leida

### Google Drive
- [ ] Compartir carpeta con Service Account → verificar acceso
- [ ] Pegar link en dashboard → drive_connection creada
- [ ] Poner Excel en carpeta → sync_google_drive.py lo detecta
- [ ] Upload job creado → worker lo procesa → datos en DB
- [ ] Modificar Excel → sync detecta cambio → re-procesa

---

## Resumen de archivos

### Crear (6)
| Archivo | Tipo |
|---------|------|
| `database/migrations/019_notifications_and_drive.sql` | SQL |
| `database/migrations/019_rollback.sql` | SQL |
| `backend/scripts/check_data_freshness.py` | Python |
| `backend/scripts/sync_google_drive.py` | Python |
| `frontend/src/components/notifications/notification-badge.tsx` | React |
| `frontend/src/components/drive/drive-connection.tsx` | React |

### Modificar (5)
| Archivo | Cambio |
|---------|--------|
| `backend/engine/connectors/smart.py` | Hash de contenido para IDs |
| `backend/config/settings.py` | +GOOGLE_SERVICE_ACCOUNT_PATH |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Integrar Drive + notificaciones |
| `frontend/src/app/(dashboard)/page.tsx` | Card de frescura en home |
| `frontend/src/components/layout/sidebar.tsx` o `bottom-nav.tsx` | Badge notificaciones |

### No modificar
| Archivo | Razon |
|---------|-------|
| `backend/engine/connectors/sync.py` | UPSERT ya funciona con nuevos IDs |
| `backend/scripts/process_uploads.py` | Drive alimenta la misma cola |
| `database/migrations/018_*` | Intactas |
