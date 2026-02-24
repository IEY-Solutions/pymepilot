# Handoff: Ingesta Multi-Canal Fase 2 — Brainstorming y Plan

**Fecha:** 2026-02-24
**Sesion:** Brainstorming + design doc + plan de implementacion
**Estado:** PLANIFICADO, listo para implementar
**Commits:** `d2e313e` (design doc), `f5b0bae` (plan)

---

## Que se hizo

Brainstorming completo para las 3 features pendientes del sistema de ingesta
multi-canal. Se exploraron opciones, se aprobaron enfoques, se escribio
design doc y plan de implementacion detallado.

**Descartado:** Canal 2b (email inbox) — eliminado del roadmap por decision de Pato.

---

## 3 Features aprobadas

### Feature 1: Upload incremental (hash de contenido)

**Problema:** SmartFileConnector genera IDs secuenciales (1, 2, 3...).
Cada upload pisa los datos anteriores.

**Solucion:** Cambiar external_id a hash de contenido:
- Clientes: `su_` + md5(nombre_normalizado)[:12]
- Productos: `su_` + md5(nombre + sku)[:12]
- Ordenes: `su_` + md5(fecha + cliente + total)[:12]

**Impacto:** Solo `backend/engine/connectors/smart.py`. SyncEngine intacto.

### Feature 2: Notificaciones de datos desactualizados

**Enfoque:** Sistema enchufable (dashboard ahora, WhatsApp futuro).

**Componentes:**
- Tablas: `tenant_notification_config`, `notifications`
- Script: `check_data_freshness.py` (cron 5:30 AM)
- UI: Badge de notificaciones en sidebar + card frescura en home
- WhatsApp: diseñado pero no implementado (Pato no tiene proveedor aun)

### Feature 3: Google Drive Sync (Canal 3)

**Enfoque:** Service Account + carpeta compartida. Polling 1x/dia a las 4:30 AM.

**Flujo:** Cliente comparte carpeta con email del Service Account → pega link en dashboard → script diario lista archivos nuevos → crea upload_job → pipeline existente lo procesa.

**Componentes:**
- Tabla: `drive_connections`
- Script: `sync_google_drive.py` (cron 4:30 AM)
- UI: Seccion "Conectar Google Drive" en /datos
- Setup: Proyecto Google Cloud + Service Account (manual)
- Dependencias: `google-api-python-client`, `google-auth`

---

## Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| `docs/plans/2026-02-24-ingesta-fase2-design.md` | Design doc completo aprobado |
| `docs/plans/2026-02-24-ingesta-fase2-plan.md` | Plan de implementacion (8 pasos) |
| `docs/plans/2026-02-24-ingesta-multicanal-design.md` | Design doc original (brainstorming anterior) |

---

## Plan de implementacion (8 pasos)

| Paso | Que | Archivos | Dependencias |
|------|-----|----------|--------------|
| 1 | Upload incremental (hash) | smart.py | Ninguna |
| 2 | Migracion SQL 019 | 019_*.sql | Ninguna |
| 3 | Script check_data_freshness.py | Nuevo script | Paso 2 |
| 4 | Mejoras UI (badge + frescura) | datos/page.tsx, sidebar, home | Paso 2 |
| 5 | Script sync_google_drive.py | Nuevo script + settings.py | Paso 2 |
| 6 | UI Drive connection | Nuevo componente + datos/page.tsx | Paso 5 |
| 7 | Google Cloud Console setup | Manual | Antes de paso 5 |
| 8 | Verificacion E2E | — | Todo lo anterior |

Pasos 1 y 2 pueden hacerse en paralelo.
Paso 7 (setup manual de Google Cloud) debe hacerse antes de probar pasos 5-6.

---

## Archivos a crear (6)

- `database/migrations/019_notifications_and_drive.sql`
- `database/migrations/019_rollback.sql`
- `backend/scripts/check_data_freshness.py`
- `backend/scripts/sync_google_drive.py`
- `frontend/src/components/notifications/notification-badge.tsx`
- `frontend/src/components/drive/drive-connection.tsx`

## Archivos a modificar (5)

- `backend/engine/connectors/smart.py` — hash de contenido para IDs
- `backend/config/settings.py` — +GOOGLE_SERVICE_ACCOUNT_PATH
- `frontend/src/app/(dashboard)/datos/page.tsx` — integrar Drive + notificaciones
- `frontend/src/app/(dashboard)/page.tsx` — card de frescura en home
- `frontend/src/components/layout/sidebar.tsx` o `bottom-nav.tsx` — badge

---

## Decisiones tomadas

1. **Notificaciones:** Dashboard + WhatsApp API directo (sin Kommo). WhatsApp queda pendiente hasta tener proveedor.
2. **Upload merge:** Append (agregar nuevos, actualizar existentes, nunca borrar).
3. **Drive auth:** Service Account (sin OAuth2). Cliente comparte carpeta manualmente.
4. **Drive frecuencia:** 1x/dia a las 4:30 AM.
5. **Email inbox:** DESCARTADO del roadmap.

---

## Para la proxima sesion

1. Leer este handoff + design doc + plan
2. Empezar por Paso 1 (upload incremental) — es el cambio mas aislado
3. Paso 2 (migracion) se puede hacer en paralelo con Paso 1
4. Para Google Drive (Pasos 5-7): necesitamos acceso a Google Cloud Console
