# Handoff: Fase 4 — Orquestador Diario

**Fecha:** 2026-02-26
**Sesion:** Implementacion completa Fase 4 (Automatizacion)
**Commits:** `4c18350` (design doc), `392a42d` (plan), `3c39938` (implementacion)

---

## Que se hizo

Implementacion completa del orquestador diario: desde brainstorming hasta
pipeline corriendo en produccion con datos reales de IEY.

### Brainstorming (6 preguntas, 6 decisiones)

| Pregunta | Decision |
|---|---|
| Script unico vs cron escalonado | Script unico (main.py) |
| Fuente de datos por tenant | Un solo canal activo por tenant |
| Verticales hardcoded vs configurable | Configurable en DB (active_verticals JSONB) |
| Manejo limite tokens | Para verticales globalmente, syncs siguen |
| Indicador dashboard | Reutilizar frescura + tarjeta nueva |
| Horario y secuencia | 5 AM: sync → atribucion → verticales |

### Implementacion (5 pasos)

| Paso | Que | Archivo |
|---|---|---|
| 1 | Migracion 024: orchestrator_runs + active_verticals | database/migrations/024_orchestrator.sql |
| 2 | Orquestador principal | backend/main.py |
| 3 | Cron entry 5 AM | crontab |
| 4 | Tarjeta predicciones del dia | frontend/src/app/(dashboard)/page.tsx |
| 5 | Test E2E dry-run + real | — |

### Sync full Contabilium (bonus — pendiente de Fase 1)

El dry-run ejecuto el sync full que estaba pendiente:
- 229 clientes (antes: ~40 de Excel)
- 2492 productos
- 351 ordenes (277 comprobantes PV 0003 + items)
- Fase 1 pasa de 95% a 100% COMPLETADA

### Test E2E real (con Claude)

- 32 candidatos identificados por vertical reposicion
- 32 predicciones generadas con mensajes personalizados
- Perfiles: VIP, Regular, Nuevo-recurrente, En riesgo
- Costo total: $0.28 USD (incluye duplicados por doble ejecucion accidental)
- 55 llamadas a Claude API (61,685 tokens)

---

## Estado completo de fases

| Fase | Estado | Auditoria |
|---|---|---|
| Fase 0 | COMPLETADA | N/A (fundacion) |
| Fase 1 | COMPLETADA | AUDITADA 0C/0H |
| Fase 2 (Motor) | COMPLETADA | AUDITADA 0C/0H |
| Fase 3 (Dashboard) | COMPLETADA | AUDITADA 0C/0H |
| Smart File Upload | COMPLETADO | Cubierto en audit Ingesta |
| Ingesta Fase 2 | COMPLETADA | AUDITADA 0C/0H |
| **Fase 4 (Automatizacion)** | **COMPLETADA** | **Pendiente auditoria** |

**24 migraciones ejecutadas** (001-024 + rollbacks)

---

## Infraestructura actual

### Crontab (5 jobs)
```
0 3 * * *   backup PostgreSQL
* * * * *   upload worker (process_uploads.py)
30 4 * * *  Google Drive sync
0 5 * * *   ★ ORQUESTADOR (main.py) ★
30 5 * * *  freshness check
```

### Datos en DB (post sync full)
- 229 clientes activos
- 2492 productos
- 351 ordenes
- 32 predicciones (hoy, con mensajes Claude)
- 1 orchestrator_run (completed)
- 55 api_usage entries ($0.28 total hoy)

### Servicios corriendo
- PostgreSQL: container `orion-menteax_postgres` (172.18.0.10:5432)
- GoTrue: 172.18.0.6:9999
- Kong: 172.18.0.11:8000
- PostgREST: schema al dia (NOTIFY enviado en migracion 024)
- Frontend: container `pymepilot-dashboard` en app.pymepilot.cloud (HTTPS)

---

## Hallazgos para investigar

### Candidatos duplicados (17/32 UniqueViolation)

Al generar predicciones, 17 de 32 candidatos fallaron con UniqueViolation en
`idx_predictions_dedup`. El check_existing_prediction() no los atrapa antes
de llamar a Claude, lo que desperdicia ~$0.085 en llamadas innecesarias.

**Causa probable:** Mismos clientes aparecen como candidatos multiples veces.
Podria ser datos duplicados en Contabilium o bug en la query de candidatos.

**Impacto:** Funcional nulo (UNIQUE index protege), economico menor (~$0.085/corrida).

**Accion:** Investigar en sesion futura. Opciones:
1. Mejorar la query de candidatos para deduplicar por customer_id
2. Mover el check_existing_prediction despues de Claude (no, peor — desperdicia mas)
3. Agregar DISTINCT en la query de get_candidates()

### VERTICAL_REGISTRY duplicado

El registry de verticales esta definido en dos lugares:
- `backend/scripts/run_vertical.py` (linea 56)
- `backend/main.py` (linea 82)

Si se agrega una nueva vertical, hay que actualizar ambos. Considerar mover a
un modulo compartido (`backend/engine/verticales/__init__.py`).

---

## Archivos nuevos/modificados

| Archivo | Accion | Descripcion |
|---|---|---|
| `backend/main.py` | Creado | Orquestador diario |
| `database/migrations/024_orchestrator.sql` | Creado | orchestrator_runs + active_verticals |
| `database/migrations/024_orchestrator_rollback.sql` | Creado | Rollback 024 |
| `frontend/src/app/(dashboard)/page.tsx` | Modificado | Tarjeta predicciones del dia |
| `docs/plans/2026-02-26-fase4-orchestrator-design.md` | Creado | Design doc aprobado |
| `docs/plans/2026-02-26-fase4-orchestrator-plan.md` | Creado | Plan 5 pasos |

---

## Proximos pasos sugeridos

1. **Auditoria Fase 4** — Correr agentes de seguridad sobre main.py, migracion 024, y cambios en dashboard
2. **Investigar candidatos duplicados** — Query de reposicion genera duplicados
3. **Fase 5 del Roadmap** — Consultar docs/ROADMAP.md para proxima fase
4. **Monitorear primera corrida automatica** — Revisar /home/pato/logs/orchestrator.log manana despues de las 5 AM

---

## Prompt para iniciar sesion nueva

```
Lee el handoff en docs/handoffs/2026-02-26_fase4_orchestrator_session.md.

Fase 4 (Automatizacion) completada. Orquestador corriendo con cron 5 AM.
32 predicciones generadas con datos reales de IEY.

Proxima tarea: [auditoria fase 4 / investigar duplicados / fase 5 / otro]
```
