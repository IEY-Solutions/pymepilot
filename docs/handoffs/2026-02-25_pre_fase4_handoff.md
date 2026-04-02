# Handoff: Pre-Fase 4 — Automatizacion

**Fecha:** 2026-02-25
**Objetivo:** Resumen del estado completo del proyecto para iniciar Fase 4.

---

## Estado de Fases Anteriores

### Fase 0: Fundacion — COMPLETADA (2026-02-19)
- DB lista, tenant IEY creado, Python conecta, migraciones 001-010 ejecutadas.
- **Pendientes:** Ninguno.

### Fase 1: Conectores ERP — 90% COMPLETADA (2026-02-22)
- Excel sync E2E OK (40 clientes, 20 productos, 30 ordenes, 67 items).
- ContabiliumConnector 100% codificado y testeado localmente.
- ExcelConnector y SmartFileConnector operativos.
- **PENDIENTE BLOQUEADO:** Sync real con Contabilium. Cloudflare devuelve 403 desde IP del VPS (173.249.9.56). Ticket abierto en soporte Contabilium.
  - Instrucciones paso a paso en: `docs/pendientes/contabilium_whitelist.md`
  - No bloquea Fase 4 — el sistema funciona con Excel/Drive como fuente de datos.

### Fase 2: Motor Inteligente V2 — COMPLETADA + AUDITADA (2026-02-22)
- VerticalReposicion operativa con datos IEY.
- ClaudeClient con 4 capas de control de costos.
- 2 rondas de auditoria, 4 fixes aplicados. 0 CRITICAL, 0 HIGH.
- **Pendiente menor:** Correr motor con datos reales de Contabilium (bloqueado por Fase 1).
- **Script:** `backend/scripts/run_vertical.py --tenant-slug iey --vertical reposicion`

### Fase 3: Dashboard MVP — COMPLETADA (2026-02-23)
- Next.js 16 en app.pymepilot.cloud (HTTPS via Traefik).
- 4 paginas: KPIs, Contactar, Historial, Datos.
- Login con Supabase Auth, usuario de test: vendedor@iey.test.
- Mobile-first, bottom-nav en celular.
- **Pendientes menores:** Ninguno bloqueante.

### Smart File Upload (Canal 2) — COMPLETADO (2026-02-24)
- Upload drag-and-drop → Storage → Worker (cron 1min) → Claude analiza → SyncEngine importa.
- E2E verificado: 32 clientes, 226 productos, 44 ordenes desde Excel IEY.
- **Worker cron:** `* * * * *` (cada minuto).

### Ingesta Fase 2 — COMPLETADA + AUDITADA (2026-02-25)
- Upload incremental (hash SHA256), notificaciones enchufables, Google Drive Canal 3.
- Google Drive sync E2E con Service Account (4:30 AM).
- Freshness check cron (5:30 AM).
- **3 rondas de auditoria:** 30 fixes totales aplicados. Estado final: 0C, 0H, 1M, 12L, 10I.
- **Commits auditoria:** `b806ce8`, `d463daa`, `1c1f48c`, `d6b555b`.

---

## Hallazgos Pendientes (no bloqueantes)

### De la auditoria ronda 3 (todos LOW/INFO):
- Migraciones 021/022 no 100% idempotentes (falta DROP IF EXISTS en FK swap)
- LIKE sin escapar `%`/`_` en busqueda historial
- `daysAgo()` en prediction-card sin NaN guard
- Error messages de Supabase expuestos al usuario en contactar/historial
- `parseInt` sin validacion de rango en paginacion
- `check_data_freshness.py` rollback no wrapeado en try/except

### Deferred (feature nueva, no fix):
- M-07: Verificacion de acceso Drive antes de guardar conexion.

### Bloqueado externamente:
- Sync real Contabilium (Cloudflare 403, ticket abierto).

---

## Infraestructura Actual

### Crontab (4 jobs)
```
0 3 * * *   backup PostgreSQL
* * * * *   upload worker (process_uploads.py)
30 4 * * *  Google Drive sync
30 5 * * *  freshness check
```

### Servicios corriendo
- PostgreSQL: container `orion-menteax_postgres` (172.18.0.10:5432)
- GoTrue: container en 172.18.0.6:9999
- Kong: container en 172.18.0.11:8000
- PostgREST: container (schema reload al dia)
- Frontend: container `pymepilot-dashboard` en app.pymepilot.cloud

### DB: orion_db
- 22 migraciones ejecutadas (001-022)
- Usuario: pymepilot_app (nosuperuser, FORCE RLS)
- RLS activo en todas las tablas de datos
- Tablas principales: tenants, customers, products, orders, order_items, predictions, sync_log, upload_jobs, notifications, drive_connections, tenant_notification_config, api_usage

### Scripts disponibles
| Script | Funcion | Cron |
|--------|---------|------|
| `process_uploads.py` | Procesa upload_jobs pendientes | Cada minuto |
| `sync_google_drive.py` | Descarga .xlsx de Drive, crea upload_jobs | 4:30 AM |
| `check_data_freshness.py` | Verifica antiguedad datos, crea notificaciones | 5:30 AM |
| `run_vertical.py` | Ejecuta motor de predicciones | Manual |
| `sync_erp.py` | Sync desde ERP (Contabilium/Excel) | Manual |
| `run_attribution.py` | Mide atribucion de predicciones | Manual |

---

## Fase 4: Automatizacion — Scope segun Roadmap

**Objetivo:** Todo funciona automaticamente cada dia sin intervencion manual.

**Entregable:** Cada manana: datos se sincronizan a las 5 AM, motor genera predicciones a las 6 AM, vendedor abre dashboard a las 8 AM y todo esta listo.

### Tareas del Roadmap:

**4.1 Orquestador principal (`backend/main.py`)**
- Flujo diario:
  1. 5:00 AM — Sincronizar datos de todos los tenants activos
  2. 6:00 AM — Ejecutar verticales activas para cada tenant
- Si un tenant falla, sigue con el siguiente
- Log completo de cada ejecucion

**4.2 Configurar servicio automatico**
- Crontab o systemd timer
- Ejecuta main.py todos los dias a las 5 AM (horario Argentina)

**4.3 Indicadores en el dashboard**
- "Ultima actualizacion: hoy 6:00 AM"
- Alerta visual si no se actualizo en >24 horas

### Que ya existe y se puede reutilizar:
- `sync_erp.py` — ya sincroniza datos (pero es manual y para 1 tenant)
- `run_vertical.py` — ya ejecuta verticales (pero manual, 1 tenant, 1 vertical)
- `check_data_freshness.py` — ya verifica antiguedad y crea alertas
- Freshness card en dashboard — ya muestra "hace X horas"
- Notification badge — ya muestra alertas de datos stale
- Crontab — ya tiene 4 jobs configurados

### Que falta construir:
- Orquestador que coordine sync + verticales para TODOS los tenants
- Cron entry para el orquestador (5 AM)
- Manejo de errores por tenant (uno falla, los demas siguen)
- Log/audit de cada ejecucion diaria
- Indicador en dashboard de "ultima corrida del motor" (distinto de "ultimo sync")

---

## Reglas Madre agregadas a AGENTS.md (2026-02-25)

Dos reglas nuevas derivadas del analisis de performance de esta sesion:

1. **Regla Madre 1 — NO evaluar si un protocolo aplica:** Si la regla dice "siempre", ejecutar sin evaluar. Las excepciones estan en la regla; si no la lista, no existe.

2. **Regla Madre 2 — AGENTS.md gana sobre concision:** Ante conflicto entre brevedad y protocolo, el protocolo gana. Pato prefiere rigor a velocidad.

---

## Prompt para iniciar sesion de Fase 4

```
Lee el handoff en docs/handoffs/2026-02-25_pre_fase4_handoff.md.

Antes de arrancar con la Fase 4, necesito que:

1. Revises el estado de las fases anteriores (0-3 + Smart Upload + Ingesta Fase 2)
   y me confirmes si hay algo pendiente que deberiamos resolver ANTES de automatizar.
   En particular: ¿hay algo que si lo automatizamos ahora, va a fallar?

2. Leido el scope de Fase 4 en docs/ROADMAP.md (seccion "Fase 4: Automatizacion"),
   lanza un /brainstorming para disenar el orquestador. Tener en cuenta:
   - Ya existen 4 cron jobs (backup, uploads, Drive, freshness)
   - Ya existen scripts manuales (sync_erp.py, run_vertical.py)
   - Contabilium esta bloqueado (Cloudflare), pero Drive y Excel funcionan
   - Solo hay 1 tenant activo (IEY), pero el diseno debe ser multi-tenant
   - El motor (run_vertical.py) llama a Claude API = costo real por ejecucion

Objetivo: que al final de esta sesion tengamos el orquestador corriendo
automaticamente y el dashboard reflejando el estado de la ultima corrida.
```
