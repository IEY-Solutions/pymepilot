# Handoff: Correcciones preventivas post-incidente Contabilium

**Fecha:** 2026-03-07
**Tipo:** Implementacion planificada (9 fixes)
**Estado:** Design doc aprobado, listo para implementar
**Design doc:** `docs/plans/2026-03-07-hotfix-preventivo-contabilium-design.md`
**Commit design:** `c409c7c`

---

## Contexto del incidente

El 5 de marzo, la API key de IEY genero 1,383 requests a Contabilium en un dia
(3 syncs completos en 5 horas: 1 manual a las 00:06, 1 orquestador manual a las
03:08, 1 cron a las 05:00), tras 6 dias de inactividad. Esto posiblemente
triggereo un bloqueo de cuenta en Contabilium/Cloudflare que impidio el acceso
web a los 3 usuarios de IEY (error DNS_PROBE_FINISHED_NXDOMAIN).

En paralelo, un bug en `setup_vapid.py` creo un archivo `backend/.env` espurio
que causo 22 horas de caida silenciosa de todos los cron jobs.

**Investigacion completa:** `docs/handoffs/2026-03-07_incidente_contabilium_investigacion.md`
**Hotfix del .env espurio:** `docs/handoffs/2026-03-07_hotfix_dotenv_sync_session.md`

---

## Estado actual

- 3 cron jobs **DESACTIVADOS** (marcados `#DISABLED_20260307#` en crontab)
- Ticket abierto en soporte de Contabilium (pendiente respuesta)
- backend/.env espurio ya eliminado (commit `e743a20`)
- setup_vapid.py ya corregido (3 dirname)
- Los usuarios de IEY pueden acceder a Contabilium (el error DNS se resolvio)

---

## Plan de implementacion (aprobado por Pato)

### Orden 1-3: Blindaje del .env (cambios mecanicos, bajo riesgo)

**Fix 1 — load_dotenv() con path explicito**
- Cambiar `load_dotenv()` a `load_dotenv(os.path.join(project_root, ".env"))` en 10 scripts:
  1. backend/main.py (linea 55)
  2. backend/scripts/sync_erp.py (linea 42)
  3. backend/scripts/process_uploads.py (linea 47)
  4. backend/scripts/sync_google_drive.py (linea 53)
  5. backend/scripts/check_data_freshness.py (linea 36)
  6. backend/scripts/run_vertical.py (linea 45)
  7. backend/scripts/run_attribution.py (linea 45)
  8. backend/scripts/create_tenant.py (linea 43)
  9. backend/scripts/setup_credentials.py (linea 40)
  10. backend/scripts/test_connection.py (linea 29)
- Todos ya calculan project_root. Solo pasar como argumento.

**Fix 2 — Guard de env vars criticas**
- Crear `backend/engine/core/env_guard.py` con funcion `validate_env(required_vars)`
- Loguea CRITICAL + sys.exit(1) si falta alguna variable
- Cada script llama validate_env() despues de load_dotenv() con sus vars especificas:
  - DB: DATABASE_HOST, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD
  - Sync ERP: DB + ERP_ENCRYPTION_KEY
  - Upload/Drive: DB + SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  - Orquestador: todas

**Fix 3 — connection.py usa settings.py**
- `_build_conninfo()` importa de settings.py en vez de leer os.getenv() directamente
- Elimina dual source of truth

### Orden 4-6: Proteccion Contabilium (necesario ANTES de reactivar crons)

**Fix 4 — Doble autenticacion**
- `contabilium.py` test_connection(): solo autenticar si `not self._access_token`
- `sync.py` linea 178: eliminar `connector.authenticate()` explicito

**Fix 5 — Rate limiting por sync_log**
- En SyncEngine.run(), antes de registrar sync: consultar si ya hubo sync exitoso
  hoy para este tenant con source='contabilium'
- Si si: WARNING + return (no sincronizar)
- sync_erp.py: agregar flag --force para bypass con WARNING

**Fix 6 — Techo de requests diario**
- Antes de cada sync, estimar requests del dia desde sync_log
  (customers_synced + products_synced + orders_synced como proxy)
- Si total estimado > 600: bloquear con error claro
- 600 = ~460 (1 sync normal) + 30% buffer

### Orden 7: Mejora menor

**Fix 7 — setup_vapid.py backup**
- shutil.copy2(env_path, env_path + ".bak") antes de reescribir

### Orden 8: Observabilidad

**Fix 8 — Cron wrapper con alertas**
- Crear `backend/scripts/cron_wrapper.py`
- Ejecuta comando hijo, trackea exit codes en /tmp/pymepilot-cron-{name}-failures
- 3 fallas consecutivas: push notification + notificacion dashboard
- Exit code 0: resetea contador
- Actualizar las 5 lineas del crontab para usar el wrapper

### Orden 9: Reactivacion controlada (con confirmacion de Pato)

1. Upload worker (no toca Contabilium) → esperar 30 min
2. Drive sync (no toca Contabilium directamente) → esperar 30 min
3. Orquestador (SI toca Contabilium) → 3 usuarios monitorean en tiempo real
4. Si alguien reporta problemas → desactivar inmediatamente

---

## Decisiones de diseno ya tomadas

- Rate limiting: via sync_log en DB (no lock files)
- Alertas de cron: push a las 3 fallas + dashboard al primer fallo
- Guard de env vars: fail-fast + log al archivo (se integra con cron wrapper)
- Prioridad: proteccion Contabilium primero (crons desactivados = urgencia)

---

## Archivos clave a modificar

| Archivo | Fixes que lo tocan |
|---------|-------------------|
| backend/engine/core/env_guard.py | **NUEVO** (fix 2) |
| backend/scripts/cron_wrapper.py | **NUEVO** (fix 8) |
| backend/engine/connectors/sync.py | 5, 6 |
| backend/engine/connectors/contabilium.py | 4 |
| backend/engine/db/connection.py | 3 |
| backend/scripts/setup_vapid.py | 7 |
| backend/scripts/sync_erp.py | 1, 2, 5 |
| backend/main.py | 1, 2 |
| + 8 scripts mas | 1, 2 |

---

## Crontab actual

```
# ACTIVOS
0 3 * * *   backup-postgresql.sh
30 5 * * *  check_data_freshness.py

# DESACTIVADOS (no reactivar sin confirmacion de Pato)
#DISABLED_20260307# * * * * *   process_uploads.py
#DISABLED_20260307# 30 4 * * *  sync_google_drive.py
#DISABLED_20260307# 0 5 * * *   main.py (orquestador con flock)
```

---

## Pendientes NO incluidos en este plan

- Respuesta de Contabilium al ticket de soporte
- Mensaje actualizado para Contabilium explicando el spike de requests
- Verificar si Contabilium tiene documentacion sobre rate limits o anomaly detection
