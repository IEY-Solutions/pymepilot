# Handoff: Auditoria Fase 3 + Pre-Fase 4

**Fecha:** 2026-02-26
**Sesion:** Auditoria de seguridad Fase 3 (Dashboard MVP)
**Commit:** `9ddcf75` — fix: auditoria fase 3 — 2H + 6M + 4L fixes + migracion 023

---

## Que se hizo

Auditoria completa de la Fase 3 (Dashboard MVP) con 4 agentes en paralelo,
seguida de re-auditoria focalizada con 2 agentes para verificar que los fixes
no rompieron nada.

### Ronda 1: Auditoria (4 agentes)

| Agente | Area | Hallazgos |
|--------|------|-----------|
| @security-guardian #1 | Secrets, Docker, search_path | 0C, 1H, 3M, 4L, 3I |
| @db-architect | RLS, permisos, get_current_tenant_id() | 0C, 1H, 3M, 3L, 2I |
| @security-guardian #2 | Kong, auth, JWTs, CORS | 0C, 1H, 3M, 4L, 3I |
| @nextjs-dashboard | Frontend, middleware, mutations, XSS | 0C, 0H, 2M, 5L, 8I |

**Consolidado deduplicado:** 0 CRITICAL, 2 HIGH, 7 MEDIUM, 12 LOW

### Ronda 2: Re-auditoria (2 agentes)

| Agente | Verificaciones | Resultado |
|--------|---------------|-----------|
| @db-architect | 14 checks | 14/14 PASS |
| @nextjs-dashboard | 19 checks | 19/19 PASS |

### Verificacion funcional (manual)

| Test | Resultado |
|------|-----------|
| pymepilot_app tenants: solo SELECT | OK |
| authenticated predictions: column-level UPDATE (3 cols) | OK |
| UPDATE confidence_score bloqueado para authenticated | OK |
| DEFAULT PRIVILEGES revocados | OK |
| Python backend con conn.commit() nuevo | OK (111 customers, 2 predictions) |
| Login page (200) | OK |
| Dashboard pages (307 redirect sin sesion) | OK |
| Security headers en produccion (4/4) | OK |

---

## Fixes aplicados (commit `9ddcf75`)

### HIGH (2)

| ID | Fix | Archivo |
|----|-----|---------|
| H-01 | .dockerignore excluye `.env*` (no solo `.env*.local`) | frontend/.dockerignore |
| H-02 | Migracion 023: REVOKE DEFAULT PRIVILEGES de 012 | database/migrations/023_security_hardening.sql |

### MEDIUM (6)

| ID | Fix | Archivo |
|----|-----|---------|
| M-01 | Security headers (X-Frame-Options, HSTS, nosniff, Referrer-Policy) | frontend/next.config.ts |
| M-02 | Column-level UPDATE predictions (solo status, contacted_at, updated_at) | database/migrations/023_security_hardening.sql |
| M-03 | REVOKE INSERT/UPDATE en tenants para pymepilot_app | database/migrations/023_security_hardening.sql |
| M-04 | conn.commit() despues de set_tenant_context() | backend/engine/db/connection.py |
| M-06 | Escapar wildcards LIKE en busqueda historial | frontend/src/app/(dashboard)/historial/page.tsx |
| M-07 | Error messages genericos (4 archivos, no exponer detalles internos) | contactar, historial, datos, drive-connection |

### LOW (4)

| ID | Fix | Archivo |
|----|-----|---------|
| L-09 | NaN guard en daysAgo() | frontend/src/components/predictions/prediction-card.tsx |
| L-10 | parseInt clampeado a [1,1000] en paginacion | frontend/src/app/(dashboard)/historial/page.tsx |
| L-11 | Error messages de uploads genericos | frontend/src/app/(dashboard)/datos/page.tsx |
| L-12 | Error message de Drive generico | frontend/src/components/drive/drive-connection.tsx |

---

## Hallazgos pendientes (backlog, no bloquean Fase 4)

### Requiere acceso root (kong.yml)

- **CORS abierto:** Kong devuelve `Access-Control-Allow-Origin: *`. Deberia restringirse a `app.pymepilot.cloud`. Requiere editar `/opt/orion-stack/configs/supabase/kong.yml` (propiedad de root).

### Documentacion pendiente

- **M-05:** Kong JWTs expiran en 2033 (7 anos). No hay proceso de rotacion documentado. Crear guia de rotacion cuando se planifique mantenimiento.

### LOW (no corregidos, riesgo minimo)

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| L-01 | search_path global en orion_db (riesgo teorico de colision) | Cuando haya tablas con nombres conflictivos |
| L-02 | Password placeholder en migracion 012 | Cosmetico, ya cambiada en produccion |
| L-03 | generate_service_role_jwt.py sin error handling + JWT larga duracion | Cuando se rote el JWT |
| L-04 | Sin .env.example en frontend | Cuando haya 2do developer |
| L-05 | GRANT USAGE ON SCHEMA auth a pymepilot_app innecesario | Cleanup futuro |
| L-06 | authenticated puede ver sync_log.error_message | Evaluar si crear VIEW |
| L-07 | Policy inerte tenants_read_all confusa | Cleanup futuro |
| L-08 | Sin rate limiting verificado en login | GoTrue default puede cubrir |

### Notas menores de re-auditoria

- drive-connection.tsx catch blocks (lineas 99, 119) exponen dbError.message al usuario. Riesgo bajo.
- daysAgo() con fecha futura muestra "Hace -N dias". Edge case preexistente.

---

## Estado completo de fases

| Fase | Estado | Auditoria |
|------|--------|-----------|
| Fase 0 | COMPLETADA | N/A (fundacion) |
| Fase 1 | 95% (sync full pendiente) | AUDITADA 0C/0H |
| Fase 2 (Motor) | COMPLETADA | AUDITADA 0C/0H |
| Fase 3 (Dashboard) | COMPLETADA | AUDITADA 0C/0H (esta sesion) |
| Smart File Upload | COMPLETADO | Cubierto en audit Ingesta |
| Ingesta Fase 2 | COMPLETADA | AUDITADA 0C/0H |
| **Fase 4** | **NO INICIADA** | — |

**23 migraciones ejecutadas** (001-023 + rollbacks)

---

## Infraestructura actual

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
- PostgREST: schema al dia
- Frontend: container `pymepilot-dashboard` en app.pymepilot.cloud (HTTPS)

### Scripts disponibles (todos manuales)
| Script | Funcion |
|--------|---------|
| sync_erp.py | Sync desde Contabilium/Excel |
| run_vertical.py | Ejecuta motor de predicciones |
| run_attribution.py | Mide atribucion de predicciones |
| process_uploads.py | Procesa upload_jobs (cron 1min) |
| sync_google_drive.py | Descarga .xlsx de Drive (cron 4:30) |
| check_data_freshness.py | Verifica antiguedad datos (cron 5:30) |

---

## Fase 4: Automatizacion — Scope

**Objetivo:** Todo funciona automaticamente cada dia sin intervencion manual.

**Entregable:** Cada manana: datos se sincronizan a las 5 AM, motor genera
predicciones a las 6 AM, vendedor abre dashboard a las 8 AM y todo esta listo.

### Tareas del Roadmap

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

### Que ya existe y se puede reutilizar
- `sync_erp.py` — sincroniza datos (manual, 1 tenant)
- `run_vertical.py` — ejecuta verticales (manual, 1 tenant, 1 vertical)
- `check_data_freshness.py` — verifica antiguedad y crea alertas (cron 5:30)
- Freshness card + notification badge en dashboard
- Crontab con 4 jobs configurados

### Que falta construir
- Orquestador que coordine sync + verticales para TODOS los tenants
- Cron entry para el orquestador (5 AM)
- Manejo de errores por tenant (uno falla, los demas siguen)
- Log/audit de cada ejecucion diaria
- Indicador en dashboard de "ultima corrida del motor"

### Consideraciones para el brainstorming
- Contabilium funciona (--limit 5 testeado) pero sync full se hara al final
- Drive y Excel ya funcionan automaticamente
- Solo 1 tenant activo (IEY) pero diseno debe ser multi-tenant
- Motor llama a Claude API = costo real por ejecucion ($0.005/candidato aprox)
- Ya existen 4 cron jobs — evaluar si el orquestador reemplaza algunos

---

## Prompt para iniciar sesion de Fase 4

```
Lee el handoff en docs/handoffs/2026-02-26_fase3_audit_and_pre_fase4.md.

Todas las fases previas estan auditadas con 0 CRITICAL, 0 HIGH.
Arrancamos con Fase 4 (Automatizacion).

Lanza /brainstorming para disenar el orquestador. Tener en cuenta:
- Ya existen 4 cron jobs (backup, uploads, Drive, freshness)
- Ya existen scripts manuales (sync_erp.py, run_vertical.py)
- Solo hay 1 tenant activo (IEY), pero el diseno debe ser multi-tenant
- El motor llama a Claude API = costo real por ejecucion
- El sync full de Contabilium se hara al final de todo
- Drive y Excel ya funcionan como fuente de datos

Objetivo: que al final de esta sesion tengamos el orquestador corriendo
automaticamente y el dashboard reflejando el estado de la ultima corrida.
```
