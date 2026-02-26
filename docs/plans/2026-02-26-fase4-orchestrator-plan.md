# Fase 4: Orquestador Diario — Plan de Implementacion

**Fecha:** 2026-02-26
**Design doc:** `docs/plans/2026-02-26-fase4-orchestrator-design.md`
**Estimacion:** 5 pasos secuenciales

---

## Paso 1: Migracion SQL (024)

**Que:** Crear tabla `orchestrator_runs` + agregar columna `active_verticals` a `tenants`.
**Por que:** El orquestador necesita donde registrar sus corridas, y saber que verticales ejecutar por tenant.

**Archivo:** `database/migrations/024_orchestrator.sql` + rollback
**Cambios:**
- CREATE TABLE `public.orchestrator_runs` (sin tenant_id, sin RLS)
- GRANT INSERT, SELECT a `pymepilot_app` y `authenticated`
- ALTER TABLE `public.tenants` ADD COLUMN `active_verticals JSONB DEFAULT '["reposicion"]'::jsonb`
- NOTIFY pgrst, 'reload schema' (para PostgREST)

**Verificacion:** Query `SELECT * FROM orchestrator_runs LIMIT 0` no da error. `SELECT active_verticals FROM tenants` retorna `["reposicion"]` para IEY.

---

## Paso 2: Backend — main.py (orquestador)

**Que:** Crear `backend/main.py` que ejecute la pipeline completa.
**Por que:** Es el "capataz" que coordina sync → atribucion → verticales para cada tenant.

**Archivo:** `backend/main.py`
**Logica:**
1. Entry point standard (sys.path, load_dotenv, umask)
2. Leer tenants activos con canal API (`erp_type NOT IN ('excel')` o equivalente)
3. Crear registro en `orchestrator_runs` con status='running'
4. Por cada tenant:
   a. Sync ERP (reutilizar SyncEngine.run() directamente, no subprocess)
   b. Si sync fallo → log error, skip resto, siguiente tenant
   c. Atribucion (reutilizar logica de run_attribution.py como funcion)
   d. Por cada vertical en tenant.active_verticals:
      - Instanciar la vertical (reutilizar _load_vertical_class del registry)
      - Ejecutar vertical.run()
      - Si DailyLimitExceeded → marcar flag, parar verticales globalmente
5. Actualizar orchestrator_runs con resultado final
6. close_pool() en finally

**Dependencias que reutiliza (sin duplicar):**
- `SyncEngine` de `backend.engine.connectors.sync`
- `VerticalBase` + registry de `backend.engine.verticales`
- `get_db_connection`, `get_tenant_id_by_slug`, `close_pool` de `backend.engine.db.connection`
- `get_predictions_for_attribution`, `update_prediction_attribution` de `backend.engine.db.queries`
- `DailyLimitExceeded` de `backend.engine.claude.client`

**Verificacion:** `python backend/main.py --dry-run` ejecuta pipeline completo sin llamar a Claude.

---

## Paso 3: Cron entry

**Que:** Agregar entrada en crontab para ejecutar main.py a las 5:00 AM.
**Por que:** Para que corra automaticamente todos los dias.

**Cambio:** Agregar linea al crontab de pato:
```
0 5 * * *  cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/main.py >> /home/pato/logs/orchestrator.log 2>&1
```

**Verificacion:** `crontab -l` muestra la entrada. Log en `/home/pato/logs/orchestrator.log`.

---

## Paso 4: Dashboard — tarjeta de predicciones del dia

**Que:** Agregar tarjeta en la pagina de KPIs que muestre predicciones de hoy y hora de ultima corrida.
**Por que:** El vendedor necesita saber de un vistazo si el sistema corrio y cuantos contactos tiene.

**Archivo:** `frontend/src/app/(dashboard)/page.tsx`
**Cambios:**
- Agregar query a `orchestrator_runs` (ultima corrida)
- Agregar query a `predictions` filtrada por `prediction_date = today` (ya existe parcialmente como pendingCount)
- Agregar KpiCard o seccion visual con "Predicciones de hoy: N" + "Ultima corrida: HH:MM AM"

**Verificacion:** Dashboard muestra la tarjeta con datos reales despues de correr `main.py --dry-run`.

---

## Paso 5: Test E2E + commit

**Que:** Correr el orquestador completo en dry-run, verificar que todo funciona, commit.
**Por que:** Validar el flujo completo antes de dejarlo automatico.

**Secuencia:**
1. `python backend/main.py --dry-run` → verifica sync + atribucion + verticales sin Claude
2. `python backend/main.py` → ejecuta real (con Claude, ~$0.005/candidato)
3. Verificar `orchestrator_runs` tiene registro con status correcto
4. Verificar dashboard muestra predicciones del dia y hora de corrida
5. Verificar `sync_log` tiene entrada nueva
6. Verificar frescura del dashboard esta verde
7. Commit final

---

## Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| `database/migrations/024_orchestrator.sql` | Crear |
| `database/migrations/024_orchestrator_rollback.sql` | Crear |
| `backend/main.py` | Crear |
| `frontend/src/app/(dashboard)/page.tsx` | Modificar |
| crontab | Modificar |

## Cron jobs resultante (despues de Fase 4)

```
0 3 * * *   backup PostgreSQL
* * * * *   upload worker
30 4 * * *  Google Drive sync
0 5 * * *   ★ ORQUESTADOR (main.py) ★
30 5 * * *  freshness check
```
