# Handoff — Fase 9: Sesion de Design (Brainstorming)

**Fecha:** 2026-03-03
**Estado:** Design aprobado, listo para implementacion
**Commit:** `d8b7af6` (docs: design doc fase 9)
**Design doc:** `docs/plans/2026-03-03-fase9-pulido-produccion-design.md`

---

## Que se hizo en esta sesion

1. **Leimos** handoff Fase 9 (`docs/handoffs/2026-03-03_fase9_handoff.md`)
2. **Reactivamos orquestador** — estaba comentado en crontab, 5 dias sin correr. Descomentado, 5/5 jobs activos. Proximo run: 2026-03-04 05:00 AM.
3. **Brainstorming completo:**
   - Pato tiene sudo en el VPS
   - Prioridad: monitoreo y alertas (salud operativa + costos)
   - Tiempo: lo que haga falta, hacerlo bien
   - Enfoque elegido: A — Grafana directo a PostgreSQL (no Prometheus instrumentation)
4. **Design aprobado** seccion por seccion (6 secciones)
5. **Design doc commiteado** con protocolos de AGENTS.md embebidos

## Descubrimientos importantes

- `orchestrator_runs` vive en `orion_db` (no en `postgres`)
- api_usage, predictions, sync_log existen en AMBAS DBs, pero el backend escribe en `orion_db`
- Grafana esta en `devgrafana.menteax.com` (Traefik HTTPS)
- Grafana container: `orion-menteax_grafana`, IP `172.18.0.12`
- PostgreSQL container: `orion-menteax_postgres`, IP `172.18.0.10`
- sudo requiere password interactiva — para archivos en /opt/orion-stack/ hay que darle comandos a Pato
- Prometheus config apunta a N8N/Qdrant que no usamos (cosmético, no se toca en Fase 9)

## Datos reales verificados (orion_db)

### api_usage
| Fecha | Llamadas | Tokens | Costo USD |
|-------|----------|--------|-----------|
| 2026-02-27 | 2 | 2,319 | $0.011 |
| 2026-02-26 | 57 | 63,447 | $0.287 |
| 2026-02-24 | 4 | 9,400 | $0.036 |
| 2026-02-22 | 5 | 2,969 | $0.015 |

### orchestrator_runs
| Fecha | Status | Tenants | Predicciones |
|-------|--------|---------|-------------|
| 2026-02-26 | completed | 1 | 20 |
| 2026-02-26 | completed | 1 | 0 |

### predictions
| Fecha | Vertical | Status | Cantidad |
|-------|----------|--------|----------|
| 2026-02-27 | cross_sell | pending | 2 |
| 2026-02-26 | recuperacion | pending | 2 |
| 2026-02-26 | reposicion | pending | 20 |

## Alcance completo aprobado (7 bloques, 5 sesiones)

| Bloque | Que | Sesion |
|--------|-----|--------|
| 0 | Orquestador reactivado | HECHO |
| 1 | Grafana → PostgreSQL (user + VIEWs + datasource) | 1 |
| 2 | Dashboard Operaciones (6 paneles) | 1 |
| 3 | Dashboard Costos (6 paneles + 2 alertas) | 2 |
| 4 | Deuda tecnica seguridad (CORS, EXCEPTION, cast, DoS) | 3 |
| 5 | Deuda tecnica calidad (formatCurrency, any, loading, norm, UNION) | 3 |
| 6 | Documentacion (ROADMAP, ARCHITECTURE, PRD) | 4 |
| 7 | Auditoria final | 5 |

## Proxima sesion: Bloque 1 + Bloque 2

### Bloque 1 — Grafana + PostgreSQL
1. Crear migration 032 con:
   - `CREATE ROLE grafana_reader` (SELECT-only)
   - 4 VIEWs de monitoreo (monitoring_operations, monitoring_costs, monitoring_syncs, monitoring_predictions)
   - GRANTs solo sobre las VIEWs
2. Aplicar migration
3. Configurar datasource en Grafana UI (Pato ejecuta lo que requiera sudo)

### Bloque 2 — Dashboard Operaciones
1. Crear dashboard "PymePilot — Operaciones" con 6 paneles
2. Configurar via Grafana API o UI
3. Verificar que muestra datos reales

### Protocolos activos (del design doc)
- Post-modificacion: 5 pasos en cada Edit/Write de .py/.sql/.ts/.tsx
- Definicion de terminado: alcance + contexto padre + segundo uso + viabilidad
- Regla de las dos opciones
- Declaracion de incertidumbre
- Context7 proactivo
- Modo educativo
- Anti-degradacion

## Archivos clave para la proxima sesion

- `docs/plans/2026-03-03-fase9-pulido-produccion-design.md` — Design doc completo
- `database/migrations/` — Donde va migration 032
- `backend/engine/db/connection.py` — Pool + tenant context (referencia)
- `backend/main.py` — Orquestador (escribe en orchestrator_runs)
- `backend/engine/core/logger.py` — Logger (referencia para patrones)

## Notas para Claude en proxima sesion

- DB es `orion_db`, NO `postgres`
- grafana_reader NO debe ver: tenant_id, customer_id, message_text, metadata de clientes
- VIEWs solo exponen metricas agregadas (conteos, sumas, estados)
- Para config Grafana que requiera archivos en /opt/orion-stack/: dar comandos a Pato
- Pato esta aprendiendo a programar — modo educativo MAXIMO
