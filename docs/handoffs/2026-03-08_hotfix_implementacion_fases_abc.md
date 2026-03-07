# Handoff: Implementacion Fases A+B+C — Correcciones post-incidente Contabilium

**Fecha:** 2026-03-08
**Tipo:** Implementacion de 14 fixes en 3 fases
**Design doc:** `docs/plans/2026-03-07-hotfix-preventivo-contabilium-design.md`
**Handoff previo:** `docs/handoffs/2026-03-07_hotfix_preventivo_handoff.md`

---

## Resumen ejecutivo

Se implementaron 14 de 15 correcciones del design doc, organizadas en 3 fases:
- **Fase A** (4 fixes): Estabilidad .env
- **Fase B** (7 fixes): Proteccion contra Contabilium
- **Fase C** (3 fixes): Observabilidad

**Fase D** (reactivacion de crons) queda PENDIENTE hasta que Contabilium resuelva
el ticket de soporte abierto el 7 de marzo.

---

## Commits

| Commit | Fase | Archivos |
|--------|------|----------|
| `e3191d8` | A — Estabilidad .env | 13 (1 nuevo + 12 modificados) |
| `47cd5f0` | B — Proteccion Contabilium | 7 modificados |
| `f09ba13` | C — Observabilidad | 3 (1 nuevo + 2 modificados) |

---

## Fase A — Estabilidad .env (commit e3191d8)

### Fix 1: load_dotenv con path explicito
- **Archivos:** 10 scripts entry point
- **Cambio:** `load_dotenv()` → `load_dotenv(os.path.join(_project_root, ".env"))`
- **Previene:** .env espurio en subdirectorio sobrescribe variables reales

### Fix 2: Guard de env vars (env_guard.py)
- **Archivo nuevo:** `backend/engine/core/env_guard.py`
- **Cambio:** Cada script llama `validate_env(DB_VARS)` despues de load_dotenv
- **Previene:** Scripts corriendo con configuracion incompleta (fail-fast)
- **Grupos predefinidos:** DB_VARS, SUPABASE_VARS, ERP_VARS

### Fix 3: connection.py usa settings.py
- **Archivo:** `backend/engine/db/connection.py`
- **Cambio:** `_build_conninfo()` importa desde settings.py en vez de os.getenv()
- **Previene:** Defaults duplicados entre connection.py y settings.py

### Fix 4: setup_vapid.py backup
- **Archivo:** `backend/scripts/setup_vapid.py`
- **Cambio:** `shutil.copy2(path, path + ".bak")` antes de modificar .env
- **Previene:** Perdida de .env si el script falla a mitad de escritura

---

## Fase B — Proteccion contra Contabilium (commit 47cd5f0)

### Fix 5: Delay 0.5s → 2.0s
- **Archivo:** `backend/config/settings.py`
- **Efecto:** ~5 req/10s en vez de ~12-20 req/10s (limite: 25)

### Fix 6: Fix doble auth
- **Archivos:** `contabilium.py` + `sync.py`
- **Cambio:** `test_connection()` solo autentica si no hay token.
  `sync.py` ya no llama `authenticate()` antes de `test_connection()`.
- **Ahorro:** 1 POST /token menos por sync

### Fix 7: Batch pacing
- **Archivo:** `contabilium.py`
- **Cambio:** `_request_count` en __init__, pausa 10s cada 20 requests en `_get()`
- **Red de seguridad:** Alineado con ventana de 10s de Contabilium

### Fix 8: Rate limiting 1 sync/dia
- **Archivos:** `sync.py` + `sync_erp.py`
- **Cambio:** Check en sync_log antes de iniciar. `--force` para bypass.
- **No aplica a:** Excel, upload, Drive (solo fuentes API)

### Fix 9: Techo diario 600 requests
- **Archivo:** `sync.py`
- **Cambio:** Suma customers+products+orders del dia en sync_log. Bloquea si >= 600.

### Fix 10: Sync incremental clientes
- **Archivos:** `contabilium.py` + `sync.py` + `base.py` + `excel.py` + `smart.py`
- **Cambio:** `fetch_customers(since_date=...)` usa `fechaDesde` en API
- **Reduccion:** ~24 paginas → ~1-2 paginas en sync diario normal

### Fix 11: Sync incremental productos
- **Archivos:** Mismos que Fix 10
- **Cambio:** `fetch_products(since_date=...)` usa `fechaDesde` en API
- **Reduccion:** ~38 paginas → ~1-5 paginas en sync diario normal

### Reduccion total de requests por sync
- **Antes:** ~353 requests
- **Ahora:** ~50-80 requests (sync incremental normal)
- **Reduccion:** ~80%

---

## Fase C — Observabilidad (commit f09ba13)

### Fix 12: Registro de 429 en sync_log
- **Archivo:** `contabilium.py`
- **Cambio:** `_handle_rate_limit_event()` inserta en sync_log con sync_type='rate_limit_event'
- **Monitoreable:** Via Grafana (query a sync_log WHERE sync_type = 'rate_limit_event')

### Fix 13: Push alert en 429
- **Archivo:** `contabilium.py`
- **Cambio:** Primer 429 de la sesion envia push "Alerta: Rate limit Contabilium"
- **Anti-spam:** Solo 1 push por sesion (no por cada retry)
- **Requiere:** `_tenant_id` en constructor (pasado desde sync.py)

### Fix 14: Cron wrapper
- **Archivo nuevo:** `backend/scripts/cron_wrapper.py`
- **Mecanismo:** Contador en /tmp/, push a las 3 fallas consecutivas, reset al exito
- **No activo aun:** Crontab se actualiza en Fase D (reactivacion)

---

## Estado del crontab (SIN CAMBIOS)

```
0 3 * * *   backup-postgresql.sh                    # ACTIVO
#DISABLED_20260307# * * * * *   process_uploads.py   # DESACTIVADO
#DISABLED_20260307# 30 4 * * * sync_google_drive.py  # DESACTIVADO
30 5 * * *  check_data_freshness.py                  # ACTIVO
#DISABLED_20260307# 0 5 * * *  main.py (orquestador)  # DESACTIVADO
```

Los crons NO se reactivan sin confirmacion explicita de Pato + resolucion
del ticket con Contabilium.

---

## Fase D — Reactivacion (PENDIENTE)

### Prerequisitos
1. Contabilium resuelve el ticket de soporte
2. Los 3 usuarios de IEY confirman acceso normal a app.contabilium.com
3. Pato da confirmacion explicita

### Pasos de reactivacion
1. Reactivar upload worker con cron_wrapper. Esperar 30 min.
2. Reactivar Drive sync con cron_wrapper. Esperar 30 min.
3. Reactivar orquestador con cron_wrapper. 3 usuarios monitorean en tiempo real.
4. Si alguien reporta problemas → desactivar inmediatamente.

### Crontab objetivo (para Fase D)
```bash
# Upload worker (cada minuto, con wrapper)
* * * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/cron_wrapper.py --name upload-worker -- backend/venv/bin/python backend/scripts/process_uploads.py >> /home/pato/logs/upload-worker.log 2>&1

# Drive sync (4:30 AM, con wrapper)
30 4 * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/cron_wrapper.py --name drive-sync -- backend/venv/bin/python backend/scripts/sync_google_drive.py >> /home/pato/logs/drive-sync.log 2>&1

# Orquestador (5:00 AM, con wrapper + flock)
0 5 * * * cd /home/pato/projects/pymepilot && flock -n /tmp/pymepilot-orchestrator.lock backend/venv/bin/python backend/scripts/cron_wrapper.py --name orchestrator -- backend/venv/bin/python backend/main.py >> /home/pato/logs/orchestrator.log 2>&1
```

---

## Archivos nuevos creados

| Archivo | Proposito |
|---------|-----------|
| `backend/engine/core/env_guard.py` | Guard fail-fast de env vars criticas |
| `backend/scripts/cron_wrapper.py` | Wrapper con contador de fallas + push alerts |

---

## Archivos modificados (14)

| Archivo | Fixes aplicados |
|---------|----------------|
| `backend/config/settings.py` | Fix 5 (delay 2.0s) |
| `backend/engine/connectors/base.py` | Fix 10+11 (since_date en ABC) |
| `backend/engine/connectors/contabilium.py` | Fix 6, 7, 10, 11, 12, 13 |
| `backend/engine/connectors/sync.py` | Fix 6, 8, 9, 10, 11, 13 |
| `backend/engine/connectors/excel.py` | Fix 10+11 (acepta since_date) |
| `backend/engine/connectors/smart.py` | Fix 10+11 (acepta since_date) |
| `backend/engine/db/connection.py` | Fix 3 (usa settings.py) |
| `backend/main.py` | Fix 1+2 |
| `backend/scripts/sync_erp.py` | Fix 1+2, Fix 8 (--force) |
| `backend/scripts/process_uploads.py` | Fix 1+2 |
| `backend/scripts/sync_google_drive.py` | Fix 1+2 |
| `backend/scripts/check_data_freshness.py` | Fix 1+2 |
| `backend/scripts/run_vertical.py` | Fix 1+2 |
| `backend/scripts/run_attribution.py` | Fix 1+2 |
| `backend/scripts/create_tenant.py` | Fix 1+2 |
| `backend/scripts/setup_credentials.py` | Fix 1+2 |
| `backend/scripts/test_connection.py` | Fix 1+2 |
| `backend/scripts/setup_vapid.py` | Fix 4 (backup .env) |

---

## Notas para auditoria

### Puntos de atencion
1. **Sync incremental (Fix 10+11):** Verificar que `fechaDesde` es un parametro
   valido en los endpoints `clientes/search` y `conceptos/search` de Contabilium.
   El design doc lo afirma basandose en la documentacion oficial. No se pudo testear
   porque la API esta inaccesible (ticket abierto).

2. **Batch pacing (Fix 7):** El contador `_request_count` se incrementa en cada
   llamada a `_get()`, incluyendo retries. Esto es intencional: un retry tambien
   consume cuota de rate limit.

3. **Rate limit check (Fix 8+9):** Usa `customers_synced + products_synced + orders_synced`
   como proxy de requests. No es exacto (no cuenta paginas ni GETs individuales de
   items), pero es una estimacion conservadora suficiente para el techo de 600.

4. **Cron wrapper (Fix 14):** No se activo en crontab. Eso es Fase D.

5. **Push de 429 (Fix 13):** Requiere VAPID keys configuradas y push_subscriptions
   activas. Si no estan, el push falla silenciosamente (best-effort).

6. **No hay migration nueva:** El design doc mencionaba una migration para registro
   de 429. Se reutilizo sync_log existente con sync_type='rate_limit_event' en vez
   de crear tabla/columna nueva. Mas simple, misma funcionalidad.
