# Handoff: Auditoria R24 — Correcciones post-hotfix Contabilium

**Fecha:** 2026-03-08
**Tipo:** Auditoria de seguridad + correcciones
**Commit:** `f0b6f28`
**Scope auditado:** Fases A+B+C del hotfix post-incidente Contabilium (commits e3191d8, 47cd5f0, f09ba13)

---

## Resumen ejecutivo

Auditoria completa de los 14 fixes implementados en las Fases A+B+C, usando 3 agentes
especializados (@security-guardian, @api-integrations, @db-architect).

**Resultado: 22 hallazgos → 5 corregidos, 7 diferidos, 10 verificaciones positivas (INFO).**

---

## Agentes y alcance

| Agente | Archivos auditados |
|--------|--------------------|
| @security-guardian | `env_guard.py`, `cron_wrapper.py`, 10 scripts entry point, `connection.py` |
| @api-integrations | `contabilium.py`, `sync.py` |
| @db-architect | `base.py`, `excel.py`, `smart.py`, cross-check `sync.py` |

---

## Correcciones aplicadas (5)

### H-01: Path traversal en cron_wrapper.py --name (HIGH → FIXED)
- **Archivo:** `backend/scripts/cron_wrapper.py`
- **Fix:** Validacion con regex `^[a-zA-Z0-9_-]+$` en `_get_counter_path()`
- **Previene:** Escritura fuera de `/tmp/pymepilot-cron-failures/`

### M-01: Techo diario contaba registros, no requests (MEDIUM → FIXED)
- **Archivo:** `backend/engine/connectors/sync.py`
- **Fix:** Renombrar `DAILY_REQUEST_CEILING` → `DAILY_RECORD_CEILING`, valor 600 → 5000
- **Previene:** Bloqueo incorrecto de `--force` (2317 registros > 600 "requests")

### M-04: Docstring prometia atomicidad inexistente (MEDIUM → FIXED)
- **Archivo:** `backend/scripts/cron_wrapper.py`
- **Fix:** Docstring ahora reconoce que read/write no son atomicos

### M-05: Timeout hardcodeado 300s (MEDIUM → FIXED)
- **Archivo:** `backend/scripts/cron_wrapper.py`
- **Fix:** Nuevo argumento `--timeout` configurable (default 300s)
- **Nota para Fase D:** Usar `--timeout 1800` para el orquestador

### M-06: setup_vapid.py sin umask (MEDIUM → FIXED)
- **Archivo:** `backend/scripts/setup_vapid.py`
- **Fix:** Agregar `os.umask(0o077)` + reutilizar `_project_root`
- **No se agrego** `load_dotenv` ni `validate_env` (script no consume env vars)

---

## Diferidos al backlog (7 — no bloqueantes)

### MEDIUMs (2)

| ID | Archivo | Descripcion | Razon de diferir |
|----|---------|-------------|------------------|
| M-02 | `sync.py` ~L215-222 | Rate delay ausente en path `connector_override` | Solo afecta conectores locales (Excel/Smart) sin rate limits |
| M-03 | `contabilium.py` ~L70 | `_TOKEN_URL` usa `.replace('/api', '')` fragil | Riesgo teorico; si URL cambia, hay que actualizar mas cosas |

### LOWs (5)

| ID | Archivo | Descripcion |
|----|---------|-------------|
| L-01 | `excel.py`, `smart.py` | Type hint faltante: `since_date=None` sin `date \| None` |
| L-02 | `sync.py` ~L215-221 | Path `connector_override` no pasa `since_date` a customers/products |
| L-03 | `contabilium.py` | `_request_count` no se resetea si se reutiliza instancia (single-use en practica) |
| L-04 | `contabilium.py` | Import lazy en `_handle_rate_limit_event` (intencional, evita circular deps) |
| L-05 | `contabilium.py` | `fetch_customers` con `client_ids` ignora `since_date` silenciosamente |

---

## Verificaciones positivas (10 INFO)

1. Los 10 scripts entry point tienen patron correcto: load_dotenv(path) → validate_env(GRUPO) → imports
2. `connection.py` ya NO usa `os.getenv()` — importa desde `settings.py`
3. `env_guard.py` hace fail-fast con sys.exit(1), loguea solo nombres (nunca valores)
4. Solo lectura verificada: NO hay _post(), _put(), _delete() en conectores
5. Prepared statements en todas las queries SQL (sin concatenacion de strings)
6. Anti-serialization guards en ContabiliumConnector (__reduce__, __getstate__)
7. Batch pacing funciona correctamente (pausa cada 20 requests, incluye retries)
8. Fix doble auth correcto (test_connection solo autentica si no hay token)
9. Sync incremental pasa fechaDesde correctamente a la API
10. Push 429 tiene anti-spam (1 por sesion) y falla silenciosamente si no hay push

---

## Estado del crontab (SIN CAMBIOS)

```
0 3 * * *   backup PostgreSQL                       # ACTIVO
#DISABLED#  upload worker (process_uploads.py)       # DESACTIVADO
#DISABLED#  Google Drive sync                        # DESACTIVADO
30 5 * * *  freshness check                          # ACTIVO
#DISABLED#  ORQUESTADOR con flock                    # DESACTIVADO
```

---

## Proximos pasos

### Fase D — Reactivacion (pendiente ticket Contabilium)
- Prerequisito: Contabilium resuelve ticket + 3 usuarios confirman acceso
- Usar `--timeout 1800` para el orquestador en crontab
- Crontab objetivo documentado en handoff anterior

### Re-auditoria recomendada
- Verificar que los 5 fixes de esta sesion no introdujeron regresiones
- Revisar los 7 diferidos si hay tiempo
- Ronda limpia esperada: 0C/0H/0M

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/scripts/cron_wrapper.py` | H-01 + M-04 + M-05 |
| `backend/engine/connectors/sync.py` | M-01 |
| `backend/scripts/setup_vapid.py` | M-06 |
