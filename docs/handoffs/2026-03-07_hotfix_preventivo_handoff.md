# Handoff: Sesion de correcciones preventivas post-incidente Contabilium

**Fecha:** 2026-03-08
**Tipo:** Implementacion de fixes (15 correcciones en 4 fases)
**Design doc:** `docs/plans/2026-03-07-hotfix-preventivo-contabilium-design.md`
**Investigacion:** `docs/handoffs/2026-03-07_incidente_contabilium_investigacion.md`

---

## Que paso (resumen ejecutivo)

### Incidente 1 — .env espurio (RESUELTO)
La sesion de Fase 10 Bloque C (2026-03-06 ~02:00 AM) ejecuto `setup_vapid.py`
multiples veces. Un bug de path creo `backend/.env` con solo 3 variables VAPID.
`load_dotenv()` sin path explicito encontraba ese archivo primero, todos los
scripts perdieron DATABASE_HOST, y los crons fallaron 22 horas silenciosamente.

**Fix aplicado:** commit `e743a20` — elimino `backend/.env`, corrigio path en
`setup_vapid.py` (3 dirname en vez de 2).

### Incidente 2 — Contabilium inaccesible (EN INVESTIGACION)
3 usuarios de IEY no podian acceder a `app.contabilium.com` (DNS_PROBE_FINISHED_NXDOMAIN).
Auditoria exhaustiva con 5 agentes: 0 requests a Contabilium desde el 5 de marzo.
Al desactivar crons, usuarios reportaron mejoria. Ticket abierto con Contabilium.

### Hallazgo clave — Rate limiting oficial
Pato encontro documentacion de Contabilium:
- **Limite Argentina:** 25 peticiones cada 10 segundos
- **Bloqueo por IP** que afecta incluso facturacion electronica
- Nuestro conector opera con delay de 0.5s (~12-20 req/10s), solo 20% de margen
- El 5 de marzo hubo 3 syncs completos → ~1,383 requests en un dia

---

## Estado actual

### Crontab
```
0 3 * * *   backup-postgresql.sh                    # ACTIVO
#DISABLED_20260307# * * * * *   process_uploads.py   # DESACTIVADO
#DISABLED_20260307# 30 4 * * * sync_google_drive.py  # DESACTIVADO
30 5 * * *  check_data_freshness.py                  # ACTIVO
#DISABLED_20260307# 0 5 * * *  main.py (orquestador)  # DESACTIVADO
```

### Branch: main
### Ultimo commit: `d92a74b` (handoff correcciones preventivas)

### Datos IEY intactos
- 126 clientes, 2021 productos, 283 ordenes, 3 push subscriptions
- Conexion DB OK (172.18.0.10:5432)
- VAPID keys consistentes backend/frontend

---

## Que hay que hacer (15 fixes en 4 fases)

El design doc completo esta en `docs/plans/2026-03-07-hotfix-preventivo-contabilium-design.md`.

### Fase A — Estabilidad interna (NO toca Contabilium)

| # | Fix | Archivos | Que hace |
|---|-----|----------|---------|
| 1 | load_dotenv con path explicito | 10 scripts | Previene que un .env intermedio rompa todo |
| 2 | Guard de env vars criticas | Nuevo env_guard.py + 10 scripts | Fail-fast si falta DATABASE_HOST etc. |
| 3 | connection.py usa settings.py | connection.py | Una sola fuente de verdad para config DB |
| 4 | setup_vapid.py backup antes de escribir | setup_vapid.py | Copia .env a .env.bak antes de reescribir |

### Fase B — Proteccion contra Contabilium (ANTES de reactivar crons)

| # | Fix | Archivos | Que hace |
|---|-----|----------|---------|
| 5 | Subir delay a 2s | settings.py | De ~20 req/10s a ~5 req/10s |
| 6 | Fix doble auth | contabilium.py + sync.py | Elimina 1 POST /token redundante por sync |
| 7 | Batch pacing 10s cada 20 req | contabilium.py | Pausa forzada alineada con ventana de Contabilium |
| 8 | Rate limiting en sync_log | sync.py + sync_erp.py | Maximo 1 sync API por tenant por dia |
| 9 | Contador requests con techo | contabilium.py + sync.py | Bloquea si >600 requests en el dia |
| 10 | Sync incremental clientes | contabilium.py + sync.py | fechaDesde: de ~24 paginas a ~1-2 |
| 11 | Sync incremental productos | contabilium.py + sync.py | fechaDesde: de ~38 paginas a ~1-5 |

### Fase C — Observabilidad

| # | Fix | Archivos | Que hace |
|---|-----|----------|---------|
| 12 | Registro de 429 en sync_log | contabilium.py + migration | Monitoreo via Grafana |
| 13 | Alerta push en 429 | contabilium.py + sender.py | Pato se entera en tiempo real |
| 14 | Cron wrapper con alertas | Nuevo cron_wrapper.py + crontab | Push a las 3 fallas consecutivas |

### Fase D — Reactivacion controlada

| # | Paso | Detalle |
|---|------|---------|
| 15a | Reactivar upload worker | No toca Contabilium. Esperar 30 min. |
| 15b | Reactivar Drive sync | No toca Contabilium. Esperar 30 min. |
| 15c | Reactivar orquestador | Toca Contabilium. 3 usuarios monitorean en tiempo real. |

**Los crons NO se reactivan sin confirmacion explicita de Pato.**

---

## Archivos clave para la sesion

| Archivo | Relevancia |
|---------|-----------|
| `backend/config/settings.py` | SYNC_RATE_LIMIT_DELAY (actualmente 0.5) |
| `backend/engine/connectors/contabilium.py` | Conector, _get(), _get_paginated(), doble auth |
| `backend/engine/connectors/sync.py` | SyncEngine.run(), authenticate() explicito linea ~178 |
| `backend/engine/db/connection.py` | _build_conninfo() lee os.getenv() directo |
| `backend/main.py` | Orquestador, calcula project_root pero no lo pasa a load_dotenv |
| `backend/scripts/*.py` | 10 scripts con load_dotenv() libre |
| `backend/scripts/setup_vapid.py` | Ya fixeado path, falta backup .env |
| `backend/engine/push/sender.py` | Para alerta push en 429 |

---

## Contexto adicional

- **Ticket Contabilium:** Abierto en Jira Service Management. Pendiente respuesta.
- **Ultimo sync exitoso:** 2026-03-05 05:00-05:06 UTC (126 clientes, 2021 productos, 283 ordenes)
- **Desde entonces:** 0 contacto con Contabilium API
- **Python venv:** `backend/venv/`
- **DB:** PostgreSQL en 172.18.0.10:5432 (container orion-menteax_postgres)
