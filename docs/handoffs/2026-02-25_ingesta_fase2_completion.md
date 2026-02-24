# Handoff: Ingesta Fase 2 — Completada

**Fecha:** 2026-02-25
**Sesiones:** 2 (24-feb planificacion + implementacion, 25-feb finalizacion + E2E)
**Commits:** `601ff0c`, `d4805b9`, pendiente 1 mas (fixes de esta sesion)

---

## Que se hizo

Implementacion completa de los 8 pasos del plan `docs/plans/2026-02-24-ingesta-fase2-plan.md`:

| Paso | Descripcion | Estado |
|------|-------------|--------|
| 1 | Upload incremental (hash de contenido) | OK |
| 2 | Migracion 019 (3 tablas nuevas) | OK |
| 3 | Script check_data_freshness.py | OK |
| 4 | UI: badge notificaciones + card frescura | OK |
| 5 | Script sync_google_drive.py | OK |
| 6 | UI: DriveConnection componente | OK |
| 7 | Google Cloud Console setup | OK |
| 8 | Verificacion E2E | OK |

### 3 features implementadas:
1. **Upload incremental:** Subir el mismo Excel 2 veces no duplica datos (hash MD5 del contenido como external_id)
2. **Notificaciones enchufables:** Badge en sidebar, card de frescura en home y datos, cron 5:30 AM
3. **Google Drive Canal 3:** Service Account, sync diario 4:30 AM, pipeline completo E2E verificado

---

## Archivos creados (8)

| Archivo | Que hace |
|---------|----------|
| `database/migrations/019_notifications_and_drive.sql` | 3 tablas: tenant_notification_config, notifications, drive_connections |
| `database/migrations/019_rollback.sql` | DROP de las 3 tablas |
| `backend/scripts/check_data_freshness.py` | Cron 5:30 AM, verifica antiguedad de datos por tenant |
| `backend/scripts/sync_google_drive.py` | Cron 4:30 AM, descarga .xlsx de Drive y crea upload_jobs |
| `frontend/src/components/notifications/notification-badge.tsx` | Badge rojo con contador de no leidas |
| `frontend/src/components/drive/drive-connection.tsx` | Conectar/desconectar carpeta Drive |
| `frontend/src/lib/freshness.ts` | getFreshnessInfo() compartido (home + datos) |
| `docs/guides/google-drive-setup.md` | Guia manual setup Google Cloud Console |

## Archivos modificados (9)

| Archivo | Cambio |
|---------|--------|
| `backend/engine/connectors/smart.py` | _content_hash() reemplaza IDs secuenciales, prefijo `su_` |
| `backend/config/settings.py` | +GOOGLE_SERVICE_ACCOUNT_PATH |
| `backend/requirements.txt` | +google-api-python-client, +google-auth |
| `frontend/src/app/(dashboard)/page.tsx` | Card de frescura debajo de KPIs |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Query drive_connections, componente DriveConnection |
| `frontend/src/app/(dashboard)/layout.tsx` | Query notificaciones unread, pasa a sidebar/bottom-nav |
| `frontend/src/components/layout/sidebar.tsx` | Prop unreadCount + NotificationBadge |
| `frontend/src/components/layout/bottom-nav.tsx` | Prop unreadCount + NotificationBadge |
| `.gitignore` | +credentials/ |

---

## Bugs encontrados y corregidos en vivo

### 1. RLS policies usaban funcion incorrecta
- **Problema:** Migracion 019 usaba `current_setting('app.tenant_id', true)::uuid` que solo funciona desde scripts Python. Desde el dashboard (PostgREST/JWT) no funciona.
- **Fix:** Cambiar las 3 policies a `get_current_tenant_id()` que prueba primero JWT y luego app.tenant_id.
- **Impacto:** drive_connections, notifications, tenant_notification_config.

### 2. DriveConnection no enviaba tenant_id
- **Problema:** El componente hacia upsert sin `tenant_id` (NOT NULL). El INSERT fallaba silenciosamente.
- **Fix:** Extraer tenant_id de `user.app_metadata` (mismo patron que file-upload.tsx).

### 3. PostgREST no conocia tablas nuevas
- **Problema:** Schema cache cargado el 23-feb, migracion ejecutada el 24-feb. PostgREST rechazaba operaciones en tablas que no conocia.
- **Fix:** `NOTIFY pgrst, 'reload schema'` — paso de 75 a 78 relations.

### 4. upload_jobs.user_id era NOT NULL
- **Problema:** Drive sync crea upload_jobs automaticamente (sin usuario humano). `user_id` NOT NULL bloqueaba el INSERT.
- **Fix:** `ALTER TABLE upload_jobs ALTER COLUMN user_id DROP NOT NULL`.

### 5. Credenciales JSON con datos extra
- **Problema:** Al pegar el JSON via heredoc, el prompt de bash quedo pegado al final del archivo.
- **Fix:** Script Python que parsea, trimea, y reescribe el JSON limpio.

### 6. Crontab upload worker sin cd
- **Problema:** La linea del upload worker no tenia `cd /home/pato/projects/pymepilot &&` al inicio.
- **Fix:** Reconstruir crontab completo.

### 7. Docker build usaba cache viejo
- **Problema:** `docker build -t pymepilot-frontend` creaba imagen con nombre distinto al que usa docker-compose (`frontend-dashboard`). El container seguia usando la imagen vieja.
- **Fix:** Usar `docker compose build --no-cache` en vez de `docker build` directo.

---

## Cambios en DB aplicados manualmente (no en migraciones)

Estos cambios se aplicaron directamente en orion_db y NO estan en archivos de migracion:

1. **RLS policies recreadas** con `get_current_tenant_id()` (3 DROP + 3 CREATE POLICY)
2. **upload_jobs.user_id** cambiado a nullable (ALTER TABLE)

**ACCION REQUERIDA para auditoria:** Decidir si crear migracion 020 que capture estos cambios, o actualizar 019 (ya actualizada en el archivo pero la DB se altero manualmente).

---

## Infraestructura configurada

### Credenciales
- `credentials/google-drive-sa.json` — Service Account JSON, chmod 600
- `.env` — `GOOGLE_SERVICE_ACCOUNT_PATH=/home/pato/projects/pymepilot/credentials/google-drive-sa.json`
- `frontend/.env.local` — `NEXT_PUBLIC_DRIVE_SERVICE_ACCOUNT_EMAIL=pymepilot-drive-sync@pymepilot-drive.iam.gserviceaccount.com`

### Crontab (4 jobs)
```
0 3 * * *   backup PostgreSQL
* * * * *   upload worker (process_uploads.py)
30 4 * * *  Google Drive sync
30 5 * * *  freshness check
```

### Google Cloud
- Proyecto: pymepilot-drive
- Service Account: pymepilot-drive-sync@pymepilot-drive.iam.gserviceaccount.com
- API: Google Drive API v3 habilitada
- Scope: drive.readonly

### Conexion Drive activa
- Tenant: IEY
- Folder ID: `1oN5WLsU6RVsBPV_U3sSU4GREBdsyrzc_`
- Status: active
- E2E verificado: archivo Excel descargado, procesado, datos en DB

---

## Puntos para auditar

### Seguridad
- [ ] RLS en las 3 tablas nuevas: tenant A no puede ver datos de tenant B
- [ ] worker_access policies: pymepilot_app tiene acceso cross-tenant correcto
- [ ] Credenciales Drive: no en git, permisos 600, .gitignore cubre credentials/
- [ ] Service Account tiene scope readonly (no puede escribir en Drive del cliente)
- [ ] upload_jobs.user_id nullable: verificar que no rompe nada en el frontend
- [ ] drive-connection.tsx: XSS check en folder_id (viene de input del usuario)

### Consistencia
- [ ] Migracion 019 vs estado real de DB (3 policies recreadas + user_id nullable)
- [ ] Design doc vs implementacion real — verificar que no hay divergencias
- [ ] Patron RLS: todas las tablas deben usar get_current_tenant_id(), no current_setting()

### Funcionalidad
- [ ] Upload incremental: mismo Excel 2 veces no duplica
- [ ] Freshness check: no crea notificaciones duplicadas por dia
- [ ] Drive sync: maneja errores por tenant sin parar los demas
- [ ] Drive sync: actualiza last_synced_at para evitar re-procesar archivos
- [ ] Notificaciones: badge se actualiza en real-time al recargar pagina

### Codigo
- [ ] sync_google_drive.py: cleanup de archivos temporales (/tmp/)
- [ ] sync_google_drive.py: manejo de archivos grandes (limite?)
- [ ] check_data_freshness.py: tenant sin sync_log (caso "nunca sincronizo")
- [ ] drive-connection.tsx: error handling si getUser() falla

---

## Proximos pasos sugeridos

1. **Auditoria de seguridad** de toda la Ingesta Fase 2
2. **Migracion 020** para formalizar cambios manuales en DB
3. **WhatsApp canal** cuando Pato tenga proveedor (la infra de notificaciones ya lo soporta)
4. **Sync Contabilium** (bloqueado por Cloudflare, ticket abierto)
5. Considerar: notificacion push cuando Drive sync importa datos nuevos
