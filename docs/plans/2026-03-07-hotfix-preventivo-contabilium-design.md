# Design Doc: Correcciones preventivas post-incidente Contabilium

**Fecha:** 2026-03-07
**Tipo:** Hotfix preventivo (9 correcciones)
**Origen:** Incidente DNS Contabilium + auditoria de codigo
**Estado:** Aprobado por Pato

---

## Contexto

El 5 de marzo, la API key de IEY genero 1,383 requests a Contabilium en un solo
dia (3 syncs completos en 5 horas), tras 6 dias de inactividad. Esto posiblemente
triggereó un bloqueo de cuenta que impidio el acceso web a los 3 usuarios de IEY.

En paralelo, un bug en `setup_vapid.py` creo un archivo `backend/.env` espurio que
causo 22 horas de caida silenciosa de todos los cron jobs (conectaban a 127.0.0.1
en vez de 172.18.0.10).

Este plan corrige las 9 vulnerabilidades identificadas, organizadas en 3 bloques.

---

## Decisiones de diseno (acordadas con Pato)

| Decision | Opcion elegida | Alternativas descartadas |
|----------|---------------|-------------------------|
| Prioridad de implementacion | Contabilium primero (crons desactivados, urgencia es tenerlos listos antes de reactivar) | Estabilidad interna primero, todo mezclado |
| Rate limiting: donde guardar control | sync_log en DB (ya existe, auditable) | Lock file local, ambos |
| Alertas de fallo de cron | Push + dashboard (push a las 3 fallas consecutivas, dashboard al primer fallo) | Solo push, solo dashboard |
| Guard de env vars: que hacer cuando falta | Fail-fast + log al archivo (se integra con alertas de cron) | Fail-fast solo, fail-fast + push |

---

## Bloque 1 — Proteccion contra Contabilium (CRITICO)

### 1.1 Rate limiting por tenant en sync_log

**Que:** Antes de iniciar un sync API, `SyncEngine.run()` consulta sync_log:
"Ya hubo un sync exitoso hoy para este tenant con source='contabilium'?"
Si si, loguea WARNING y retorna sin hacer nada.

**Donde:** `backend/engine/connectors/sync.py`, en `run()` despues de obtener
`erp_type` y antes de registrar en sync_log.

**Bypass:** `sync_erp.py` acepta flag `--force` que salta el check con WARNING.

**No aplica a:** Excel, Smart Upload, Drive (el usuario puede subir cuando quiera).

### 1.2 Fix doble autenticacion

**Que:** `test_connection()` en `contabilium.py` llama `authenticate()` siempre.
Pero `sync.py:177-179` tambien llama `authenticate()` antes de `test_connection()`.
Resultado: 2 POST /token por sync.

**Fix:** En `test_connection()`, solo autenticar si no hay token:
```python
def test_connection(self) -> bool:
    if not self._access_token:
        self.authenticate()
    # ... resto igual
```
Y en `sync.py`, eliminar el `authenticate()` explicito de linea 178.

### 1.3 Contador de requests diario con techo

**Que:** Antes de cada sync, estimar el volumen total del dia consultando
sync_log (`customers_synced + products_synced + orders_synced` como proxy).
Si el total estimado supera 600 requests, bloquear con error claro.

**Limite:** 600 = ~460 (1 sync normal) + 30% buffer.

**Donde:** `SyncEngine.run()`, junto al check de rate limiting (1.1).

---

## Bloque 2 — Estabilidad del .env (ALTA)

### 2.1 load_dotenv() con path explicito

**Que:** Los 10 scripts que usan `load_dotenv()` pasan a usar path explicito:
```python
load_dotenv(os.path.join(project_root, ".env"))
```
Todos ya calculan `project_root`. Solo hay que pasarlo.

**Scripts afectados (10):**
1. backend/main.py
2. backend/scripts/sync_erp.py
3. backend/scripts/process_uploads.py
4. backend/scripts/sync_google_drive.py
5. backend/scripts/check_data_freshness.py
6. backend/scripts/run_vertical.py
7. backend/scripts/run_attribution.py
8. backend/scripts/create_tenant.py
9. backend/scripts/setup_credentials.py
10. backend/scripts/test_connection.py

**Nota:** Fix #6 (main.py no usa project_root) se resuelve automaticamente.

### 2.2 Guard de env vars criticas

**Que:** Nueva funcion `validate_env()` en `backend/engine/core/env_guard.py`.

```python
def validate_env(required_vars: list[str]) -> None:
    """Verifica que las env vars criticas existen y no estan vacias.
    Loguea CRITICAL + sys.exit(1) si falta alguna."""
```

Cada script llama `validate_env()` despues de `load_dotenv()`, con las vars
que necesita:
- DB: DATABASE_HOST, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD
- Sync ERP: DB + ERP_ENCRYPTION_KEY
- Upload/Drive: DB + SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- Orquestador: todas

### 2.3 connection.py usa settings.py

**Que:** `_build_conninfo()` lee `os.getenv()` directamente, duplicando defaults
de settings.py. Cambiar a importar desde settings.py → una sola fuente de verdad.

### 2.4 setup_vapid.py backup antes de escribir

**Que:** Antes de reescribir .env, copiar a `.env.bak`:
```python
shutil.copy2(env_path, env_path + ".bak")
```

---

## Bloque 3 — Observabilidad (MEDIA)

### 3.1 Cron wrapper con alertas

**Que:** Nuevo `backend/scripts/cron_wrapper.py` que envuelve cada cron job.

**Mecanismo:**
1. Ejecuta el comando hijo
2. Si exit code != 0, incrementa contador en `/tmp/pymepilot-cron-{name}-failures`
3. A las 3 fallas consecutivas: push notification + notificacion dashboard
4. Si exit code == 0: resetea contador

**Crontab actualizado:**
```bash
backend/venv/bin/python backend/scripts/cron_wrapper.py --name upload-worker -- \
  backend/venv/bin/python backend/scripts/process_uploads.py \
  >> /home/pato/logs/upload-worker.log 2>&1
```

**Ventajas del wrapper externo:**
- Un solo lugar para logica de alertas (no repetir en 5 scripts)
- Detecta OOM kills y errores de import (el script no llega a ejecutar)
- Independiente del .env (solo necesita el contador + push)

---

## Orden de implementacion

| Orden | Fix | Archivos | Complejidad |
|-------|-----|----------|-------------|
| 1 | load_dotenv explicito (2.1) | 10 scripts | Baja |
| 2 | Guard env vars (2.2) | Nuevo env_guard.py + 10 scripts | Baja |
| 3 | connection.py usa settings.py (2.3) | connection.py | Baja |
| 4 | Fix doble auth (1.2) | contabilium.py + sync.py | Baja |
| 5 | Rate limiting sync_log (1.1) | sync.py + sync_erp.py | Media |
| 6 | Contador requests diario (1.3) | contabilium.py + sync.py | Media |
| 7 | setup_vapid.py backup (2.4) | setup_vapid.py | Baja |
| 8 | Cron wrapper alertas (3.1) | Nuevo cron_wrapper.py + crontab | Media |
| 9 | Reactivacion controlada | Crontab | — |

**Entregables:**
- 2 archivos nuevos: env_guard.py, cron_wrapper.py
- ~14 archivos modificados
- 0 migraciones SQL
- Crontab actualizado como paso final

---

## Paso final: Reactivacion controlada

Despues de aplicar los 8 fixes, reactivar crons uno a la vez:
1. Reactivar upload worker (no toca Contabilium)
2. Esperar 30 min, verificar
3. Reactivar Drive sync (no toca Contabilium directamente)
4. Esperar 30 min, verificar
5. Reactivar orquestador (este SI toca Contabilium)
6. Los 3 usuarios monitorean app.contabilium.com en tiempo real
7. Si alguien reporta problemas, desactivar inmediatamente

**Los crons NO se reactivan sin confirmacion explicita de Pato.**
