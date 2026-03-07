# Design Doc: Correcciones preventivas post-incidente Contabilium

**Fecha:** 2026-03-07 (actualizado 2026-03-07 noche)
**Tipo:** Hotfix preventivo (15 correcciones)
**Origen:** Incidente DNS Contabilium + auditoria de codigo + documentacion oficial de rate limiting
**Estado:** Aprobado por Pato

---

## Contexto

El 5 de marzo, la API key de IEY genero 1,383 requests a Contabilium en un solo
dia (3 syncs completos en 5 horas), tras 6 dias de inactividad. Esto posiblemente
triggereó un bloqueo de cuenta que impidio el acceso web a los 3 usuarios de IEY.

En paralelo, un bug en `setup_vapid.py` creo un archivo `backend/.env` espurio que
causo 22 horas de caida silenciosa de todos los cron jobs (conectaban a 127.0.0.1
en vez de 172.18.0.10).

Adicionalmente, Pato encontro la documentacion oficial de Contabilium sobre limites
de uso, que revela que nuestro conector opera al filo del limite permitido:

### Limites oficiales de Contabilium

| Pais | Limite |
|------|--------|
| Argentina | 25 peticiones cada 10 segundos |
| Chile/Uruguay | 15 peticiones cada 10 segundos |

**Bloqueo ante exceso (429):** Por IP, dura ~1 minuto.
**Alcance critico:** "Si un proceso de sincronizacion de stock excede el limite,
tambien se vera afectada tu capacidad de emitir facturas electronicas desde esa misma red."

### Volumen real del ultimo sync exitoso (5 de marzo)

```
 24 paginas clientes     (GET clientes/search)
 38 paginas productos    (GET conceptos/search)
 ~6 paginas comprobantes (GET comprobantes/search)
283 GETs individuales    (GET comprobantes/?id=XXX para Items)
  2 POST /token          (doble auth — bug 1.2)
---
~353 requests por sync
```

Con `SYNC_RATE_LIMIT_DELAY = 0.5s`, el ritmo es ~12-20 req/10s (limite: 25).
Solo 20% de margen. Cualquier retry o variacion en latencia puede superarlo.
El 5 de marzo se corrieron 3 syncs → ~1,060+ requests reales (1,383 contando retries).

### Recomendaciones oficiales de Contabilium vs estado actual

| Recomendacion | Estado actual | Gap |
|---------------|---------------|-----|
| Retry con delay >= 10s entre bloques | `SYNC_RATE_LIMIT_DELAY = 0.5s` | Delay 20x menor al recomendado |
| Sincronizacion selectiva con `fechaDesde` | Solo `fetch_orders` usa `fechaDesde`. Clientes y productos: sync full siempre | Requests innecesarios cada dia |
| Monitoreo del 429 | Manejo con retry en codigo, pero sin registro en DB ni alerta | Fallo silencioso |

Este plan corrige las 15 vulnerabilidades identificadas, organizadas en 4 bloques.

---

## Decisiones de diseno (acordadas con Pato)

| Decision | Opcion elegida | Alternativas descartadas |
|----------|---------------|-------------------------|
| Prioridad de implementacion | Estabilidad interna primero (Fase A), luego Contabilium (Fase B), luego observabilidad (Fase C) | Todo mezclado, Contabilium primero |
| Rate limiting: donde guardar control | sync_log en DB (ya existe, auditable) | Lock file local, ambos |
| Alertas de fallo de cron | Push + dashboard (push a las 3 fallas consecutivas, dashboard al primer fallo) | Solo push, solo dashboard |
| Guard de env vars: que hacer cuando falta | Fail-fast + log al archivo (se integra con alertas de cron) | Fail-fast solo, fail-fast + push |
| Delay entre requests | 2s fijo + batch pacing 10s cada 20 req (doble capa) | Solo subir delay, solo batch pacing |
| Sync incremental | `fechaDesde` con fallback a sync full si no hay fecha previa | Siempre incremental (riesgo de datos huerfanos) |
| Alerta en 429 | Push inmediato (ya existe infra) | Solo log, email |

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

## Bloque 4 — Rate limiting y best practices Contabilium (ALTA)

> **Origen:** Documentacion oficial de Contabilium encontrada por Pato el 2026-03-07.
> Limite Argentina: 25 peticiones/10 segundos. Bloqueo por IP afecta facturacion.

### 4.1 Subir delay entre requests

**Que:** Cambiar `SYNC_RATE_LIMIT_DELAY` de 0.5s a 2s en `settings.py`.

**Efecto:** Reduce de ~12-20 req/10s a ~5 req/10s. Amplio margen bajo el limite
de 25. El sync completo tarda ~12 min en vez de ~3 min, pero corre a las 5 AM
sin impacto para nadie.

**Donde:** `backend/config/settings.py` (1 linea).

### 4.2 Batch pacing (pausa entre bloques)

**Que:** Agregar pausa de 10s cada 20 requests, alineado con la ventana de 10
segundos que Contabilium usa para medir. Implementar como contador interno en
`_get()` que incrementa por cada request y duerme al llegar a 20.

**Donde:** `backend/engine/connectors/contabilium.py` — atributo `_request_count`
en `__init__`, logica en `_get()`.

**Interaccion con 4.1:** Son complementarios. El delay de 2s entre requests
(4.1) limita la velocidad sostenida. El batch pacing (4.2) agrega una pausa
larga cada 20 requests como red de seguridad. Con ambos, el peor caso seria
~5 req/10s con pausas forzadas cada 20.

### 4.3 Sync incremental de clientes

**Que:** Agregar parametro `since_date` a `fetch_customers()`. Cuando se provee,
usar `fechaDesde` en el endpoint `clientes/search` para descargar solo clientes
modificados desde el ultimo sync exitoso.

**Donde:** `contabilium.py` (fetch_customers) + `sync.py` (pasar
`last_sync_date` desde sync_log).

**Impacto:** Reduce de ~24 paginas (126 clientes) a ~1-2 paginas en syncs diarios
normales (solo clientes nuevos o modificados desde ayer).

**Sync full:** Se mantiene como fallback si no hay fecha previa (primer sync)
o si se usa `--force`.

### 4.4 Sync incremental de productos

**Que:** Idem 4.3 para `fetch_products()` con `conceptos/search` y `fechaDesde`.

**Donde:** `contabilium.py` (fetch_products) + `sync.py`.

**Impacto:** Reduce de ~38 paginas (2021 productos) a ~1-5 paginas. IEY no
agrega productos diariamente, asi que la mayoria de los dias seria 0-1 paginas.

### 4.5 Registro de 429 en sync_log

**Que:** Cuando `_get()` recibe un HTTP 429, registrar en sync_log o tabla
dedicada: timestamp, endpoint, retry_after recibido, request_count acumulado.

**Donde:** `contabilium.py` (_get, bloque 429) + migration nueva (si tabla
dedicada) o columna extra en sync_log.

**Beneficio:** Permite monitorear via Grafana si estamos recibiendo 429s.
Tendencia creciente = hay que reducir mas el ritmo.

### 4.6 Alerta push en 429

**Que:** Si se recibe un HTTP 429, enviar push notification a Pato
inmediatamente. Ya tenemos el sistema de push funcionando (3 suscripciones
activas).

**Donde:** `contabilium.py` (importar sender) + `backend/engine/push/sender.py`.

**Mensaje:** "Contabilium devolvio 429 (rate limit) durante el sync.
El sistema espero y reintento. Revisar logs si se repite."

---

## Orden de implementacion

### Fase A — Estabilidad interna (prerequisito, no toca Contabilium)

| Orden | Fix | Archivos | Complejidad |
|-------|-----|----------|-------------|
| 1 | load_dotenv explicito (2.1) | 10 scripts | Baja |
| 2 | Guard env vars (2.2) | Nuevo env_guard.py + 10 scripts | Baja |
| 3 | connection.py usa settings.py (2.3) | connection.py | Baja |
| 4 | setup_vapid.py backup (2.4) | setup_vapid.py | Baja |

### Fase B — Proteccion contra Contabilium (aplicar ANTES de reactivar crons)

| Orden | Fix | Archivos | Complejidad |
|-------|-----|----------|-------------|
| 5 | Subir delay a 2s (4.1) | settings.py | Trivial |
| 6 | Fix doble auth (1.2) | contabilium.py + sync.py | Baja |
| 7 | Batch pacing 10s cada 20 req (4.2) | contabilium.py | Media |
| 8 | Rate limiting sync_log (1.1) | sync.py + sync_erp.py | Media |
| 9 | Contador requests diario (1.3) | contabilium.py + sync.py | Media |
| 10 | Sync incremental clientes (4.3) | contabilium.py + sync.py | Media |
| 11 | Sync incremental productos (4.4) | contabilium.py + sync.py | Media |

### Fase C — Observabilidad (puede aplicarse antes o despues de reactivar)

| Orden | Fix | Archivos | Complejidad |
|-------|-----|----------|-------------|
| 12 | Registro de 429 en sync_log (4.5) | contabilium.py + migration | Media |
| 13 | Alerta push en 429 (4.6) | contabilium.py + sender.py | Baja |
| 14 | Cron wrapper alertas (3.1) | Nuevo cron_wrapper.py + crontab | Media |

### Fase D — Reactivacion

| Orden | Fix | Archivos | Complejidad |
|-------|-----|----------|-------------|
| 15 | Reactivacion controlada | Crontab | — |

**Entregables:**
- 2 archivos nuevos: env_guard.py, cron_wrapper.py
- 1 migration nueva (registro 429)
- ~14 archivos modificados
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
