# Handoff: Incidente Contabilium DNS — Investigacion en curso

**Fecha:** 2026-03-07
**Tipo:** Incidente de produccion (investigacion abierta)
**Estado:** EN CURSO — pendiente respuesta de Contabilium
**Sesion:** ~2 horas de investigacion

---

## Resumen del incidente

Desde la noche del 2026-03-06, los usuarios de la cuenta IEY en Contabilium (Pato, Agustin, y un tercer integrante) no pueden acceder a `app.contabilium.com`. El error reportado es `DNS_PROBE_FINISHED_NXDOMAIN` en el navegador. Contabilium afirma que su servidor estuvo activo y atribuye el problema a PymePilot.

**Coincidencias temporales fuertes:**
1. La franja horaria del inicio de los problemas coincide con la sesion de Fase 10 Bloque C (2026-03-06 ~02:00 AM), donde se hicieron multiples modificaciones a archivos .env, multiples ejecuciones de `setup_vapid.py`, y cambios de claves VAPID
2. Al desactivar los cron jobs de PymePilot, los 3 usuarios reportaron mejoria (se mantuvieron conectados a Contabilium sin cortes)

---

## Contexto previo — Incidente del .env espurio

Ver handoff completo: `docs/handoffs/2026-03-07_hotfix_dotenv_sync_session.md`

**Resumen:** La sesion de Fase 10 Bloque C (commit `8da422a`, 2026-03-06 02:19) introdujo Web Push Notifications. El script `setup_vapid.py` tenia un bug que calculaba `project_root` como `backend/` en vez de `pymepilot/`, lo que creo un archivo `backend/.env` espurio con solo 3 variables VAPID. Esto causo que todos los scripts del cron fallaran durante ~22 horas (conectaban a `127.0.0.1:5432` en vez de `172.18.0.10:5432`).

**Fix aplicado:** Commit `e743a20` (2026-03-07 00:00:40) — elimino `backend/.env`, corrigio `setup_vapid.py` (3 dirname en vez de 2).

**Dato adicional de Pato:** `setup_vapid.py` fue ejecutado MULTIPLES veces durante la sesion. Hubo muchos ingresos a carpetas .env y modificacion de claves. La sesion anterior de Codex no respeto los protocolos de AGENTS.md.

---

## Acciones tomadas en esta sesion

### 1. Desactivacion de cron jobs (inmediata)

Se desactivaron 3 cron jobs marcandolos con `#DISABLED_20260307#`:

```
#DISABLED_20260307# * * * * *   process_uploads.py    (upload worker)
#DISABLED_20260307# 30 4 * * *  sync_google_drive.py  (Drive sync)
#DISABLED_20260307# 0 5 * * *   main.py con flock     (orquestador)
```

Quedaron activos:
- `0 3 * * *` — backup PostgreSQL (no toca Contabilium)
- `30 5 * * *` — freshness check (solo datos locales)

**Resultado:** Los 3 usuarios de IEY reportaron mejoria en el acceso a Contabilium tras la desactivacion.

### 2. Verificacion de desconexion total

| Check | Resultado |
|-------|-----------|
| Procesos Python de PymePilot corriendo | Ninguno |
| Cron jobs que tocan Contabilium | 3/3 desactivados |
| Conexiones TCP desde Python | Ninguna |
| Lock del orquestador | Inactivo |

### 3. Ticket abierto en soporte de Contabilium

Se abrio ticket en Jira Service Management de Contabilium con:
- Descripcion del error DNS_PROBE_FINISHED_NXDOMAIN
- Informacion de que nuestro ultimo request a su API fue el 2026-03-05 05:05 UTC
- Solicitud de verificar cambios en configuracion DNS/Cloudflare

**Estado del ticket:** Pendiente respuesta.

### 4. Auditoria exhaustiva con 5 agentes en paralelo

Se lanzaron 5 agentes especializados investigando distintos angulos:

| Agente | Angulo | Resultado |
|--------|--------|-----------|
| Security Guardian (logs) | 4 archivos de log, 22 horas | 0 requests a Contabilium. 1325 errores, TODOS de DB local |
| General (red/DNS) | resolv.conf, /etc/hosts, firewall, Traefik, VPN | 0 configuracion que toque Contabilium |
| API Integrations (codigo) | 6 archivos del conector Contabilium | 4 barreras secuenciales antes de cualquier request. Imposible sin DB |
| General (Docker) | 16 containers, Traefik, Kong, cron de sistema | 0 menciones a contabilium en containers, routing, ni servicios |
| Security Guardian (git) | Ultimos 20 commits, diffs 3 dias | 0 cambios al conector de Contabilium |

### 5. Investigacion adicional post-auditoria

Se investigaron angulos adicionales que los agentes no cubrieron:

| Angulo | Resultado |
|--------|-----------|
| Service Worker (sw.js) | Solo escucha `push` y `notificationclick`. NO intercepta fetch/navegacion |
| Push banner (push-banner.tsx) | Registra SW y suscribe a push. No toca Contabilium |
| API route push/subscribe | Solo guarda suscripcion en DB local |
| Push sender (sender.py) | Envia via pywebpush a endpoints de Google/Mozilla, no Contabilium |
| PostgreSQL extensiones | Solo pgcrypto, plpgsql, uuid-ossp. No hay http, pg_net, ni pg_cron |
| PostgreSQL triggers | 5 triggers, todos `set_updated_at()`. Ningun HTTP call |
| PostgreSQL funciones | 0 funciones que referencien contabilium o HTTP |
| Supabase hooks | No existe tabla supabase_functions.hooks |
| Archivos .env residuales | 5 archivos .env encontrados, ninguno en `backend/` (el espurio ya fue eliminado) |
| Kong logs | 0 menciones a contabilium. Solo trafico interno Next.js-PostgREST |
| Traefik logs | 0 forwarding hacia contabilium. Solo dominios propios (pymepilot.cloud, menteax.com) |
| Frontend container | 0 errores, 0 referencias a contabilium |

### 6. Verificacion DNS desde el VPS

| Check | Resultado |
|-------|-----------|
| `nslookup app.contabilium.com` | Resuelve: 104.20.29.254, 172.66.153.151 (Cloudflare) |
| `dig app.contabilium.com` desde Google DNS | Resuelve correctamente |
| `curl -sI https://app.contabilium.com` | HTTP 403 (Cloudflare bloquea IP datacenter — comportamiento conocido) |
| `curl -v https://rest.contabilium.com` | TLS 1.3 OK, certificado valido, HTTP 403 (Cloudflare) |

---

## Evidencia clave del periodo del incidente

### Logs del orquestador (2026-03-06)

```
05:00:03 ORQUESTADOR INICIADO
05:00:03 Database connection pool created
         [17x Connection refused 127.0.0.1:5432]
05:00:33 Error catastrofico: PoolTimeout
         Status: failed | Tenants procesados: 0/0
```

**Nunca llego a instanciar ContabiliumConnector. Murio en conexion a DB local.**

### Ultimo contacto exitoso con Contabilium

```
2026-03-05 05:00:05  authenticate(): token obtenido OK
2026-03-05 05:04:55  GET clientes/ -> 200 (x24 paginas)
2026-03-05 05:05:09  fetch_customers(): 126 clientes
2026-03-05 05:05:47  GET conceptos/search -> 200 (x38 paginas)
2026-03-05 05:05:49  Sync completado: 126 clientes, 2021 productos, 283 ordenes
```

**Desde entonces: 0 tokens OAuth solicitados, 0 requests GET, 0 contacto con Contabilium.**

### Upload worker (2026-03-07, post-fix)

68 ejecuciones entre 00:00 y el momento de desactivacion. Cada una:
```
pool created -> DB acquired (x2) -> pool closed
```
Solo queries locales (check_stale_jobs + process_one_job). 0 contacto externo.

---

## Timestamps de archivos .env modificados durante la sesion caotica

| Archivo | Modificado | Lineas | Bytes |
|---------|-----------|--------|-------|
| `.env` (raiz) | 2026-03-06 02:01:17 | 43 | 1733 |
| `frontend/.env.local` | 2026-03-06 02:01:17 | 10 | 689 |
| `frontend/.next/standalone/.env` | 2026-03-06 00:58:34 | 2 | 252 |
| `.env.example` | 2026-02-22 (sin cambios) | 31 | 1042 |

**Nota:** `.env` raiz y `frontend/.env.local` fueron modificados al mismo segundo (02:01:17), indicando que `setup_vapid.py` fue ejecutado al menos una vez con el path CORRECTO (ademas de las veces con el path incorrecto que crearon `backend/.env`).

---

## Lo que NO se pudo explicar

1. **Mecanismo tecnico:** No se encontro ningun camino en nuestro codigo/infra que pueda causar `DNS_PROBE_FINISHED_NXDOMAIN` en el navegador de usuarios externos para un dominio de terceros
2. **Correlacion cron-mejoria:** Los 3 usuarios mejoraron al desactivar nuestros crons, pero los crons no tocaban Contabilium (verificado exhaustivamente)
3. **Posible explicacion no verificable:** Contabilium podria tener reglas internas (Cloudflare, rate limiting, seguridad de cuenta) que vinculen la actividad de la API key con el acceso web de la cuenta. Esto no es visible desde nuestro lado.

---

## Hipotesis pendientes de verificar

### H1: Contabilium tiene bloqueo a nivel de cuenta (PROBABILIDAD: MEDIA)
Si Contabilium/Cloudflare tiene un mecanismo que bloquea toda la cuenta cuando detecta actividad sospechosa de la API key, el sync del 5 de marzo (que fue exitoso y normal) podria haber generado un flag que activo un bloqueo temporal. Desactivar los crons no habria "arreglado" nada — la mejoria seria coincidencia con la expiracion natural del bloqueo.

### H2: Efecto residual de las modificaciones .env (PROBABILIDAD: BAJA-MEDIA)
Las multiples ejecuciones de `setup_vapid.py` pudieron haber corrompido temporalmente las credenciales de Contabilium en el `.env`. Si alguna ejecucion parcial dejo el .env con credenciales invalidas, y luego el orquestador intento autenticar con esas credenciales... pero los logs muestran que el orquestador nunca llego a Contabilium (murio en DB).

### H3: Coincidencia temporal (PROBABILIDAD: MEDIA)
Contabilium tuvo un problema de DNS/Cloudflare independiente que coincidio con nuestra sesion caotica. La mejoria al desactivar crons fue coincidencia con la resolucion natural del problema de su lado.

### H4: Algo invisible desde nuestro lado (PROBABILIDAD: DESCONOCIDA)
Algun efecto de red, IP reputation, o mecanismo de Cloudflare que no podemos diagnosticar desde nuestro VPS.

---

## Hallazgos de mejora interna (de la auditoria)

| Prioridad | Hallazgo | Descripcion |
|-----------|----------|-------------|
| ALTA | `load_dotenv()` sin path explicito | Los 12 scripts usan `load_dotenv()` libre. Cualquier `.env` intermedio rompe todo. Causa raiz de las 22 horas de caida. |
| ALTA | Sin validacion de env vars criticas | No hay guard que verifique que DATABASE_HOST, ERP_ENCRYPTION_KEY, etc. no esten vacias al arrancar |
| ALTA | main.py no pasa project_root a load_dotenv | Calcula project_root pero no lo usa para load_dotenv (lineas 50, 55) |
| MEDIA | Sin alertas de fallo de cron | 22 horas de fallo silencioso sin notificacion |
| MEDIA | connection.py re-lee os.getenv() | Dual source of truth: settings.py y connection.py leen env vars independientemente |
| BAJA | setup_vapid.py escribe .env sin backup | Si se interrumpe a mitad de escritura, el .env queda corrupto |

---

## Mejoras al conector Contabilium — Best practices oficiales

> **Origen:** Documentacion oficial de Contabilium sobre limites de uso y estabilidad,
> encontrada por Pato el 2026-03-07 durante la investigacion del incidente.

### Limites documentados por Contabilium

| Pais | Limite |
|------|--------|
| Argentina | 25 peticiones cada 10 segundos |
| Chile/Uruguay | 15 peticiones cada 10 segundos |

**Comportamiento ante excesos (429):**
- Bloqueo por IP, dura normalmente 1 minuto
- **CRITICO:** "Si un proceso de sincronizacion de stock excede el limite, tambien se vera afectada tu capacidad de emitir facturas electronicas desde esa misma red"

### Estado actual de nuestro conector vs recomendaciones

| Recomendacion Contabilium | Estado actual | Gap | Prioridad |
|---------------------------|---------------|-----|-----------|
| Retry con delay >= 10s entre bloques | `SYNC_RATE_LIMIT_DELAY = 0.5s` entre requests | **Delay 20x menor** al recomendado. ~20 req/10s (limite: 25). Al filo. | ALTA |
| Sincronizacion selectiva con `fechaDesde` | `fetch_orders` usa `fechaDesde`, pero `fetch_customers` y `fetch_products` hacen sync full siempre | Clientes y productos descargan todo en cada sync, generando requests innecesarios | ALTA |
| Monitoreo del 429 | `_get()` maneja 429 con retry + Retry-After, pero no hay alerta/log persistente | No queda registro en DB de cuantos 429 recibimos. No hay forma de saber si estamos al filo. | MEDIA |

### Volumen real del sync del 5 de marzo (ultimo exitoso)

```
24 paginas clientes    (GET clientes/search)
38 paginas productos   (GET conceptos/search)
~6 paginas comprobantes (GET comprobantes/search)
283 GETs individuales  (GET comprobantes/?id=XXX para Items)
  1 POST /token        (autenticacion)
---
~352 requests totales en ~3 minutos
~20 requests por ventana de 10 segundos (limite: 25)
```

**Conclusion:** Estamos dentro del limite, pero con solo 20% de margen. Cualquier retry,
re-auth, o variacion en latencia puede empujarnos sobre el limite de 25.

### Mejoras propuestas

| # | Mejora | Descripcion | Archivo(s) | Impacto |
|---|--------|-------------|------------|---------|
| C-01 | Subir delay entre requests | Cambiar `SYNC_RATE_LIMIT_DELAY` de 0.5s a 2s. Reduce de ~20 req/10s a ~5 req/10s. El sync tardara ~12 min en vez de ~3 min, pero es 5x mas seguro. | `settings.py`, `contabilium.py` | Elimina riesgo de 429 |
| C-02 | Delay post-bloque (batch pacing) | Agregar pausa de 10s cada 20 requests (bloque), alineado con la ventana de 10s de Contabilium. Aplica dentro de `_get_paginated` y en el loop de `fetch_orders`. | `contabilium.py` | Cumple recomendacion oficial |
| C-03 | Sync incremental de clientes | Agregar parametro `fechaDesde` a `fetch_customers` (endpoint `clientes/search` lo soporta). En sync diario, solo descargar clientes modificados desde ultimo sync. | `contabilium.py`, `sync.py` | Reduce requests de ~24 paginas a ~1-2 |
| C-04 | Sync incremental de productos | Idem C-03 para `fetch_products` con `conceptos/search` y `fechaDesde`. | `contabilium.py`, `sync.py` | Reduce requests de ~38 paginas a ~1-5 |
| C-05 | Registro de 429 en DB | Crear columna o tabla para registrar cada 429 recibido (timestamp, endpoint, retry_after). Permite monitorear tendencia y detectar si estamos cerca del limite. | `contabilium.py`, migration nueva | Visibilidad de salud de la integracion |
| C-06 | Alerta push en 429 | Si se recibe un 429, enviar push notification a Pato (ya tenemos el sistema de push). Asi se entera en tiempo real sin revisar logs. | `contabilium.py`, `sender.py` | Deteccion inmediata |

### Orden de implementacion sugerido

1. **C-01** (5 min) — cambio de config, impacto inmediato, 0 riesgo
2. **C-02** (30 min) — batch pacing, cumple recomendacion oficial
3. **C-03 + C-04** (1-2 hrs) — sync incremental, reduce volumen drasticamente
4. **C-05 + C-06** (1 hr) — monitoreo y alertas

---

## Proximos pasos

### Inmediatos
1. **Esperar respuesta de Contabilium** al ticket de soporte
2. **Compartir con Contabilium** el analisis: 0 API calls desde el 5 de marzo, pedir que verifiquen mecanismos de seguridad a nivel de cuenta. Incluir que encontramos su documentacion de rate limiting y que estamos implementando mejoras.
3. **Crons permanecen desactivados** hasta resolver

### Cuando Contabilium responda
4. **Reconexion controlada** — reactivar UN cron a la vez, con los 3 usuarios monitoreando Contabilium en tiempo real:
   - Paso 1: Reactivar freshness check (solo DB local, 0 riesgo)
   - Paso 2: Reactivar upload worker (solo DB local)
   - Paso 3: Reactivar orquestador (este SI toca Contabilium API)
   - Esperar 30 min entre cada paso. Si algun usuario reporta problemas, desactivar inmediatamente.

### Preventivos — Resiliencia interna (proxima sesion)
5. **Fix critico:** Cambiar todos los `load_dotenv()` a path explicito
6. **Guard de arranque:** Validar env vars criticas antes de ejecutar cualquier script
7. **Alertas de cron:** Implementar notificacion cuando un cron falla N veces consecutivas
8. **Auditoria de sesion anterior:** Revisar que se hizo en la sesion de Fase 10 Bloque C que violo los protocolos de AGENTS.md

### Preventivos — Conector Contabilium (proxima sesion)
9. **C-01:** Subir `SYNC_RATE_LIMIT_DELAY` a 2s (cambio inmediato antes de reactivar crons)
10. **C-02:** Implementar batch pacing (pausa 10s cada 20 requests)
11. **C-03 + C-04:** Sync incremental para clientes y productos
12. **C-05 + C-06:** Registro de 429 en DB + alerta push

---

## Archivos relevantes

- Este handoff: `docs/handoffs/2026-03-07_incidente_contabilium_investigacion.md`
- Handoff del .env espurio: `docs/handoffs/2026-03-07_hotfix_dotenv_sync_session.md`
- Commit Fase 10 Bloque C: `8da422a` (24 archivos, 1294 lineas)
- Commit Mis Ventas: `fe4bc00` (11 archivos, 381 lineas)
- Commit fix setup_vapid.py: `e743a20` (1 archivo, 2 lineas)
- Conector Contabilium: `backend/engine/connectors/contabilium.py`
- Push sender: `backend/engine/push/sender.py`
- Service worker: `frontend/public/sw.js`
- Logs: `/home/pato/logs/orchestrator.log`, `upload-worker.log`, `drive-sync.log`, `freshness-check.log`

---

## Estado actual del crontab

```
# PymePilot cron jobs
0 3 * * * backup-postgresql.sh                              # ACTIVO (no toca Contabilium)
#DISABLED_20260307# * * * * * process_uploads.py             # DESACTIVADO
#DISABLED_20260307# 30 4 * * * sync_google_drive.py          # DESACTIVADO
30 5 * * * check_data_freshness.py                           # ACTIVO (solo DB local)
#DISABLED_20260307# 0 5 * * * main.py (orquestador con flock) # DESACTIVADO
```
